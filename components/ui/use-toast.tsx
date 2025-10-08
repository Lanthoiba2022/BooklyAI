"use client";

import { useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000); // auto-hide after 3s
  };

  const Toast = () =>
    message ? (
      <div className="fixed bottom-4 right-4 bg-black text-white px-4 py-2 rounded shadow-lg z-50">
        {message}
      </div>
    ) : null;

  return { showToast, Toast };
}
