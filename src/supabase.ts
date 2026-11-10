
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uurjgzqmiwxqkwyvkheu.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_P8G0y_BaN0StH_Pltew6rA_HkJhHfED";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
