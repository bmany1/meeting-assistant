import React from "react";
import { createRoot } from "react-dom/client";
// Import the DEFAULT export from the shipped single file. This wrapper is the
// only thing that knows the file path; the artifact itself never imports this.
import MeetingAssistant from "../meeting-assistant";

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <MeetingAssistant />
    </React.StrictMode>
  );
}
