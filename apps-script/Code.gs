/**
 * CMMS — Google Docs companion (Apps Script side).
 *
 * Thin by design: this layer only touches the document (selections, named
 * ranges, highlights) and relays everything else to the CMMS backend, which
 * does all measuring and deciding. Markers are named ranges called
 * `cmms_segment_<uuid>` — the exact thing the backend sync engine reads.
 */

var DEFAULT_BASE_URL = 'https://cmms-backend-m01s.onrender.com';
var MARKER_PREFIX = 'cmms_segment_';

// ---------- Menu & sidebar ----------

function onOpen() {
  DocumentApp.getUi().createMenu('CMMS').addItem('Open sidebar', 'showSidebar').addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('CMMS');
  DocumentApp.getUi().showSidebar(html);
}

// ---------- Settings (stored per user, never exposed to the HTML frame) ----------

function getSettings() {
  var props = PropertiesService.getUserProperties();
  return {
    baseUrl: props.getProperty('CMMS_BASE_URL') || DEFAULT_BASE_URL,
    hasToken: !!props.getProperty('CMMS_TOKEN'),
  };
}

function saveSettings(baseUrl, token) {
  var props = PropertiesService.getUserProperties();
  if (baseUrl) {
    var normalized = String(baseUrl).trim().replace(/\/+$/, '').replace(/\/api\/v1$/, '');
    props.setProperty('CMMS_BASE_URL', normalized);
  }
  if (token) {
    props.setProperty('CMMS_TOKEN', String(token).trim());
  }
  return getSettings();
}

function disconnect() {
  PropertiesService.getUserProperties().deleteProperty('CMMS_TOKEN');
  return getSettings();
}

// Absorbs the free-tier cold start before any real call.
function pingBackend() {
  var base = getSettings().baseUrl;
  for (var attempt = 0; attempt < 2; attempt++) {
    try {
      var res = UrlFetchApp.fetch(base + '/health', { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) return { ok: true };
    } catch (e) {
      // fall through to retry
    }
    Utilities.sleep(3000);
  }
  return { ok: false };
}

// ---------- Backend client ----------

function apiRequest_(method, path, body) {
  var props = PropertiesService.getUserProperties();
  var token = props.getProperty('CMMS_TOKEN');
  if (!token) throw new Error('Not connected. Paste your connect code from the CMMS web app (Settings).');

  var base = props.getProperty('CMMS_BASE_URL') || DEFAULT_BASE_URL;
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  };
  if (body) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }

  var res = UrlFetchApp.fetch(base + '/api/v1' + path, options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  var parsed = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (e) {
    parsed = {};
  }

  if (code === 401 && parsed.message && parsed.message.indexOf('Invalid token') !== -1) {
    throw new Error('Your connect code has expired. Copy a fresh one from the CMMS web app (Settings).');
  }
  if (code >= 300) {
    throw new Error(parsed.message || 'CMMS server error (HTTP ' + code + ')');
  }
  return parsed;
}

// ---------- Document status ----------

function getDocStatus() {
  var doc = DocumentApp.getActiveDocument();
  var status = {
    googleFileId: doc.getId(),
    title: doc.getName(),
    registered: false,
    document: null,
    markerIds: getMarkerIds_(doc),
  };
  try {
    var res = apiRequest_('get', '/documents/by-file/' + encodeURIComponent(doc.getId()));
    status.registered = true;
    status.document = res.data;
  } catch (e) {
    if (String(e.message).indexOf('not registered') === -1) throw e;
  }
  return status;
}

function registerDoc() {
  var doc = DocumentApp.getActiveDocument();
  apiRequest_('post', '/documents', { google_file_id: doc.getId() });
  return getDocStatus();
}

// ---------- Marker & highlight primitives ----------

function getMarkerIds_(doc) {
  var ids = [];
  var ranges = doc.getNamedRanges();
  for (var i = 0; i < ranges.length; i++) {
    var name = ranges[i].getName();
    if (name && name.indexOf(MARKER_PREFIX) === 0) {
      var id = name.substring(MARKER_PREFIX.length);
      if (ids.indexOf(id) === -1) ids.push(id);
    }
  }
  return ids;
}

function markSelection_(doc, markerId) {
  var selection = doc.getSelection();
  if (!selection) throw new Error('Select some text in the document first.');
  doc.addNamedRange(MARKER_PREFIX + markerId, selection);
}

function removeMarker_(doc, markerId) {
  var ranges = doc.getNamedRanges(MARKER_PREFIX + markerId);
  for (var i = 0; i < ranges.length; i++) {
    ranges[i].remove();
  }
}

function applyHighlight_(doc, markerId, color) {
  var ranges = doc.getNamedRanges(MARKER_PREFIX + markerId);
  for (var i = 0; i < ranges.length; i++) {
    var rangeElements = ranges[i].getRange().getRangeElements();
    for (var j = 0; j < rangeElements.length; j++) {
      var re = rangeElements[j];
      var el = re.getElement();
      var text;
      try {
        text = el.editAsText();
      } catch (e) {
        continue; // element type without text
      }
      if (!text || text.getText() === '') continue;
      if (re.isPartial()) {
        text.setBackgroundColor(re.getStartOffset(), re.getEndOffsetInclusive(), color);
      } else {
        text.setBackgroundColor(color);
      }
    }
  }
}

function goToSegment(markerId) {
  var doc = DocumentApp.getActiveDocument();
  var ranges = doc.getNamedRanges(MARKER_PREFIX + markerId);
  if (ranges.length === 0) return false;
  doc.setSelection(ranges[0].getRange());
  return true;
}

// ---------- Backend-driven actions ----------

function createSegmentFromSelection(payload) {
  var doc = DocumentApp.getActiveDocument();
  var markerId = Utilities.getUuid();
  markSelection_(doc, markerId);

  var segment;
  try {
    segment = apiRequest_('post', '/segments/from-marker', {
      google_file_id: doc.getId(),
      marker_id: markerId,
      category_id: payload.category_id,
      title: payload.title || undefined,
      tag_ids: payload.tag_ids && payload.tag_ids.length ? payload.tag_ids : undefined,
    }).data;
  } catch (e) {
    removeMarker_(doc, markerId); // don't leave orphan markers behind
    throw e;
  }

  applyHighlight_(doc, markerId, segment.color);
  return { id: segment.id, title: segment.title, color: segment.color };
}

function associateSelection(payload) {
  var doc = DocumentApp.getActiveDocument();
  var markerId = Utilities.getUuid();
  markSelection_(doc, markerId);

  var segment;
  try {
    segment = apiRequest_('post', '/segments/from-marker', {
      google_file_id: doc.getId(),
      marker_id: markerId,
      associate_with_segment_id: payload.segment_id,
      association_type: payload.association_type,
    }).data;
  } catch (e) {
    removeMarker_(doc, markerId);
    throw e;
  }

  applyHighlight_(doc, markerId, segment.color);
  return { id: segment.id, title: segment.title, color: segment.color };
}

function insertFromLibrary(payload) {
  var doc = DocumentApp.getActiveDocument();
  var source = apiRequest_('get', '/segments/' + payload.segment_id).data;

  var insertedText;
  var cursor = doc.getCursor();
  if (cursor) {
    insertedText = cursor.insertText(source.text_content);
  }
  if (!insertedText) {
    insertedText = doc.getBody().appendParagraph(source.text_content).editAsText();
  }

  if (!payload.linked) {
    return { linked: false };
  }

  var markerId = Utilities.getUuid();
  var range = doc.newRange().addElement(insertedText).build();
  doc.addNamedRange(MARKER_PREFIX + markerId, range);

  var segment;
  try {
    segment = apiRequest_('post', '/segments/from-marker', {
      google_file_id: doc.getId(),
      marker_id: markerId,
      associate_with_segment_id: payload.segment_id,
      association_type: 'derivative',
    }).data;
  } catch (e) {
    removeMarker_(doc, markerId);
    throw e;
  }

  applyHighlight_(doc, markerId, segment.color);
  return { linked: true, id: segment.id, color: segment.color };
}

function listDocSegments() {
  var status = getDocStatus();
  if (!status.registered) return { registered: false, segments: [] };

  var res = apiRequest_('get', '/segments?document_id=' + status.document.id + '&limit=200');
  var segments = [];
  for (var i = 0; i < res.data.length; i++) {
    var s = res.data[i];
    segments.push({
      id: s.id,
      title: s.title,
      color: s.color,
      category: s.category ? { name: s.category.name, icon: s.category.icon } : null,
      tags: s.tags || [],
      is_primary: s.is_primary,
      markerPresent: status.markerIds.indexOf(s.id) !== -1,
    });
  }
  return { registered: true, document: status.document, segments: segments };
}

function searchLibrary(q) {
  var res = apiRequest_('get', '/segments?search=' + encodeURIComponent(q) + '&limit=20');
  var out = [];
  for (var i = 0; i < res.data.length; i++) {
    var s = res.data[i];
    out.push({
      id: s.id,
      title: s.title,
      color: s.color,
      snippet: (s.text_content || '').substring(0, 90),
      category: s.category ? s.category.name : '',
    });
  }
  return out;
}

function getCategories() {
  return apiRequest_('get', '/categories').data;
}

function getTags() {
  return apiRequest_('get', '/tags').data;
}

function createTag(name) {
  return apiRequest_('post', '/tags', { name: name }).data;
}

function addTagsToSegment(segmentId, tagIds) {
  return apiRequest_('post', '/segments/' + segmentId + '/tags', { tag_ids: tagIds }).data;
}

function syncMarkers() {
  var doc = DocumentApp.getActiveDocument();
  var status = getDocStatus();
  if (!status.registered) throw new Error('Register this document first.');

  var result = apiRequest_('post', '/sync/document/' + status.document.id).data;

  // Re-apply highlight colors so the doc matches the library after edits
  var listing = listDocSegments();
  for (var i = 0; i < listing.segments.length; i++) {
    var s = listing.segments[i];
    if (s.markerPresent) applyHighlight_(doc, s.id, s.color);
  }

  return {
    updated: result.updated_segments,
    repositioned: result.repositioned_segments,
    orphans: (result.orphaned_segments || []).map(function (o) {
      return o.title || 'Untitled';
    }),
  };
}
