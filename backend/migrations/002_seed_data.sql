-- Insert default departments
INSERT INTO departments (id, name, description, contact_email, contact_phone) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Public Works', 'Responsible for road maintenance, street cleaning, and infrastructure', 'publicworks@city.gov', '555-0101'),
('550e8400-e29b-41d4-a716-446655440001', 'Sanitation', 'Waste management, recycling, and garbage collection', 'sanitation@city.gov', '555-0102'),
('550e8400-e29b-41d4-a716-446655440002', 'Parks and Recreation', 'Maintenance of parks, playgrounds, and recreational facilities', 'parks@city.gov', '555-0103'),
('550e8400-e29b-41d4-a716-446655440003', 'Utilities', 'Water, sewer, gas, and electrical infrastructure', 'utilities@city.gov', '555-0104'),
('550e8400-e29b-41d4-a716-446655440004', 'Transportation', 'Traffic management, public transit, and parking', 'transport@city.gov', '555-0105'),
('550e8400-e29b-41d4-a716-446655440005', 'Building and Safety', 'Building inspections, code enforcement, and safety', 'building@city.gov', '555-0106');

-- Insert default categories
INSERT INTO categories (name, description, icon, color, department_id) VALUES
-- Public Works categories
('Potholes', 'Road surface damage, holes, and cracks', 'road', '#FF6B35', '550e8400-e29b-41d4-a716-446655440000'),
('Street Lighting', 'Broken or malfunctioning street lights', 'lightbulb', '#FFD23F', '550e8400-e29b-41d4-a716-446655440000'),
('Sidewalk Issues', 'Damaged, cracked, or obstructed sidewalks', 'footprint', '#74C0FC', '550e8400-e29b-41d4-a716-446655440000'),
('Storm Drains', 'Blocked or damaged storm drainage systems', 'water', '#4DABF7', '550e8400-e29b-41d4-a716-446655440000'),

-- Sanitation categories
('Garbage Collection', 'Missed pickups, overflowing bins, or schedule issues', 'trash', '#51CF66', '550e8400-e29b-41d4-a716-446655440001'),
('Illegal Dumping', 'Unauthorized disposal of waste or debris', 'alert-triangle', '#FF8787', '550e8400-e29b-41d4-a716-446655440001'),
('Recycling Issues', 'Problems with recycling collection or facilities', 'recycle', '#69DB7C', '550e8400-e29b-41d4-a716-446655440001'),

-- Parks and Recreation categories
('Park Maintenance', 'General park upkeep, landscaping, and cleanliness', 'tree', '#40C057', '550e8400-e29b-41d4-a716-446655440002'),
('Playground Equipment', 'Damaged or unsafe playground equipment', 'child', '#FD7E14', '550e8400-e29b-41d4-a716-446655440002'),
('Sports Facilities', 'Issues with courts, fields, or recreational facilities', 'activity', '#15AABF', '550e8400-e29b-41d4-a716-446655440002'),

-- Utilities categories
('Water Issues', 'Water main breaks, leaks, or pressure problems', 'droplet', '#339AF0', '550e8400-e29b-41d4-a716-446655440003'),
('Sewer Problems', 'Sewer backups, odors, or blockages', 'alert-circle', '#8B5CF6', '550e8400-e29b-41d4-a716-446655440003'),
('Power Lines', 'Electrical hazards, down power lines, or outages', 'zap', '#F59E0B', '550e8400-e29b-41d4-a716-446655440003'),

-- Transportation categories
('Traffic Signals', 'Malfunctioning traffic lights or signs', 'traffic-light', '#EF4444', '550e8400-e29b-41d4-a716-446655440004'),
('Road Signs', 'Missing, damaged, or obscured road signs', 'sign', '#6366F1', '550e8400-e29b-41d4-a716-446655440004'),
('Parking Issues', 'Parking meter problems or illegal parking', 'car', '#84CC16', '550e8400-e29b-41d4-a716-446655440004'),

-- Building and Safety categories
('Building Violations', 'Code violations, unsafe structures, or permits', 'home', '#F97316', '550e8400-e29b-41d4-a716-446655440005'),
('Noise Complaints', 'Excessive noise from construction or businesses', 'volume-x', '#EC4899', '550e8400-e29b-41d4-a716-446655440005'),
('Safety Hazards', 'General safety concerns and hazardous conditions', 'shield-alert', '#DC2626', '550e8400-e29b-41d4-a716-446655440005');

-- Create default admin user (password: admin123)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_verified, is_active) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'admin@city.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System', 'Administrator', 'admin', TRUE, TRUE);

-- Create sample staff users
INSERT INTO users (email, password_hash, first_name, last_name, role, department_id, is_verified, is_active) VALUES
('john.doe@city.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'John', 'Doe', 'staff', '550e8400-e29b-41d4-a716-446655440000', TRUE, TRUE),
('jane.smith@city.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Jane', 'Smith', 'staff', '550e8400-e29b-41d4-a716-446655440001', TRUE, TRUE),
('mike.wilson@city.gov', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mike', 'Wilson', 'staff', '550e8400-e29b-41d4-a716-446655440002', TRUE, TRUE);