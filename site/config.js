// ------------------------------------------------------------------
// Fill these in after creating your Supabase project (see README.md).
// The anon key is meant to be public. Row Level Security (set up by
// supabase-setup.sql) is what keeps strangers from editing your gallery.
// NEVER put the "service_role" key in this file.
// ------------------------------------------------------------------
window.APP_CONFIG = {
  SUPABASE_URL: "https://ohnatcfqcqusnvbmwbjy.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9obmF0Y2ZxY3F1c252Ym13Ymp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODQ0NTEsImV4cCI6MjEwNzQ2MDQ1MX0.bSHjEqoYB5mE9htOmagsoooN8A44-U3c81fhSAnKJN4",
  BUCKET: "photos",

  // Text shown on the gallery page
  TITLE: "Our Little Memories",
  SUBTITLE: "Month 8 with you",
  CLOSING_MESSAGE: "Happy monthsary, langga. Here's to many more months, and a lot more photos.",

  // Optional cute passcode gate on the gallery page. Leave "" to turn it off.
  // This is a surprise-style gate, NOT real security (anyone can read the JS).
  PASSCODE: "Roblox",
  PASSCODE_HINT: "Hint: our first game together",
};
