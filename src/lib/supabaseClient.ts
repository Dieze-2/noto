import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://joxdblsmudzqetaiqhdl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpveGRibHNtdWR6cWV0YWlxaGRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxOTE0NDAsImV4cCI6MjA4Nzc2NzQ0MH0.zKUc4Hj7Q_iW0bHBbBNo384MlU55lugHtF4DzOtOJLE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
