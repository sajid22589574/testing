async function askQuestion() {
  const question = document.getElementById("question").value.trim();
  const chatBox = document.getElementById("chatBox");

  if (!question) return;

  const qEl = document.createElement("div");
  qEl.className = "user";
  qEl.textContent = "You: " + question;
  chatBox.appendChild(qEl);

  document.getElementById("question").value = "";

  const loading = document.createElement("div");
  loading.className = "bot";
  loading.textContent = "Thinking...";
  chatBox.appendChild(loading);

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });

    const data = await res.json();
    loading.textContent = "Bot: " + data.answer;
  } catch (err) {
    loading.textContent = "Error: Could not get response.";
  }

  chatBox.scrollTop = chatBox.scrollHeight;
}
