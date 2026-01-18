-- ==========================================
-- Comedy Material Management System (CMMS)
-- PostgreSQL Database Schema
-- ==========================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS TABLE
-- Supplements Google OAuth profile information
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_image_url TEXT,
    watched_folder_id VARCHAR(255), -- ID of the Google Drive folder being watched
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. USER PREFERENCES TABLE
-- Stores UI settings and color configurations
CREATE TABLE user_preferences (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_category_id UUID,
    -- Default palette: Red, Green, Blue, Amber, Purple, Teal, Deep Orange, Brown, Blue Grey, Pink (300 series)
    color_palette JSONB DEFAULT '["#E57373","#81C784","#64B5F6","#FFD54F","#BA68C8","#4DB6AC","#FF8A65","#A1887F","#90A4AE","#F06292"]',
    auto_assign_colors BOOLEAN DEFAULT true,
    theme VARCHAR(50) DEFAULT 'system',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. CATEGORIES TABLE
-- Structural types of comedy material (e.g., Bit, Set, One-Liner)
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50), -- Emoji or icon identifier
    sort_order INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false, -- True for system defaults, false for user-created
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 4. TAGS TABLE
-- content/subject/technique descriptors
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    tag_type VARCHAR(50), -- 'subject', 'technique', 'theme', 'status', or NULL
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 5. DOCUMENTS TABLE
-- Registered Google Docs acting as source-of-truth
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    google_file_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    google_folder_id VARCHAR(255),
    mime_type VARCHAR(100) DEFAULT 'application/vnd.google-apps.document',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    last_modified_at TIMESTAMP WITH TIME ZONE, -- Timestamp from Google Drive
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, google_file_id)
);

-- 6. SEGMENTS TABLE
-- The core unit: marked sections of text within documents
CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id), -- No Cascade (prevent accidental bulk deletion)
    
    -- Marker positions (character offsets within the Google Doc)
    start_offset INTEGER NOT NULL,
    end_offset INTEGER NOT NULL,
    
    -- Denormalized content for local search and display
    text_content TEXT NOT NULL,
    text_content_tsvector TSVECTOR, -- PostgreSQL full-text search vector
    
    -- Display & Metadata
    title VARCHAR(255), -- Optional override, otherwise generated from text
    color VARCHAR(7) NOT NULL, -- Hex color code
    is_primary BOOLEAN DEFAULT true, -- False if this is a derivative/copy
    word_count INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. SEGMENT TAGS (JUNCTION TABLE)
CREATE TABLE segment_tags (
    segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (segment_id, tag_id)
);

-- 8. SEGMENT ASSOCIATIONS TABLE
-- Links between segments (e.g., a Bit inside a Set, or a Callback referencing a Setup)
CREATE TABLE segment_associations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    target_segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    association_type VARCHAR(50) NOT NULL, -- 'derivative', 'callback', 'reference', 'version'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_segment_id, target_segment_id)
);

-- 9. COLOR USAGE TABLE
-- Tracks color utilization to power the smart assignment algorithm
CREATE TABLE color_usage (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    color VARCHAR(7) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    usage_count INTEGER DEFAULT 1,
    PRIMARY KEY (user_id, color)
);

-- 10. SYNC LOG TABLE
-- For debugging sync operations and conflict resolution
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL, -- 'full_sync', 'segment_update', 'marker_repair'
    status VARCHAR(50) NOT NULL, -- 'success', 'failed', 'conflict'
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- INDEXES
-- ==========================================

-- Full-text search index (GIN)
CREATE INDEX segments_text_search_idx ON segments USING GIN(text_content_tsvector);

-- Composite indexes for common query patterns
CREATE INDEX segments_user_category_idx ON segments(user_id, category_id);
CREATE INDEX segments_document_idx ON segments(document_id);
CREATE INDEX documents_user_folder_idx ON documents(user_id, google_folder_id);

-- ==========================================
-- TRIGGERS & FUNCTIONS
-- ==========================================

-- Function to automatically update tsvector and word_count
CREATE OR REPLACE FUNCTION segments_text_search_trigger() RETURNS trigger AS $$
BEGIN
    -- Update TSVECTOR: Combine text_content and title (if present)
    NEW.text_content_tsvector := to_tsvector('english', COALESCE(NEW.text_content, '') || ' ' || COALESCE(NEW.title, ''));
    
    -- Update WORD COUNT: count whitespace-separated words
    NEW.word_count := array_length(regexp_split_to_array(trim(NEW.text_content), '\s+'), 1);
    
    -- Update timestamp on modification
    NEW.updated_at := NOW();
    
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Trigger definition
CREATE TRIGGER segments_text_search_update
    BEFORE INSERT OR UPDATE ON segments
    FOR EACH ROW EXECUTE FUNCTION segments_text_search_trigger();

-- Function to update updated_at timestamps on other tables
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply timestamp triggers to other tables
CREATE TRIGGER update_users_modtime BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prefs_modtime BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cats_modtime BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_docs_modtime BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- SEED DATA
-- ==========================================

-- Note: Since categories are user-scoped, this seed data is intended 
-- to be run whenever a new user is created. 
-- However, for the purpose of this file, we can create a procedure or 
-- simply document the INSERT values to be used in your application logic.

-- Example Function to Seed Default Categories for a New User
CREATE OR REPLACE FUNCTION seed_default_categories(new_user_id UUID) RETURNS VOID AS $$
BEGIN
    INSERT INTO categories (user_id, name, description, icon, sort_order, is_default) VALUES
    (new_user_id, 'One-Liner', 'Short, self-contained joke', '💬', 10, true),
    (new_user_id, 'Bit', 'A distinct chunk of material on a specific topic', '🧩', 20, true),
    (new_user_id, 'Set', 'A collection of bits arranged for performance', '🎤', 30, true),
    (new_user_id, 'Sketch', 'Scripted scene for multiple characters', '🎭', 40, true),
    (new_user_id, 'Premise', 'An idea or concept not yet fully fleshed out', '💡', 50, true),
    (new_user_id, 'Callback', 'A reference to an earlier joke', '↩️', 60, true),
    (new_user_id, 'Crowd Work', 'Interactions with the audience', '👥', 70, true),
    (new_user_id, 'Opener', 'Material used to start a set', '🎬', 80, true),
    (new_user_id, 'Closer', 'Strong material used to end a set', '🏁', 90, true)
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$$ LANGUAGE plpgsql;