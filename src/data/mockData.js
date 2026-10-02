export const mockConversations = [
  {
    id: "conversation-1",
    title: "Explain React hooks",
    updatedAt: "Today",
    messages: [
      {
        id: "message-1",
        role: "user",
        content: "Can you explain React hooks in a simple way?",
        createdAt: new Date().toISOString(),
      },
      {
        id: "message-2",
        role: "assistant",
        content: `## React Hooks

React Hooks are functions that allow functional components to use React features such as state and lifecycle behavior.

### Common hooks

- **useState** — manages component state
- **useEffect** — handles side effects
- **useRef** — stores values without causing re-renders
- **useMemo** — memoizes expensive calculations

For example:

\`\`\`jsx
import { useState } from "react";

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
\`\`\`

The important idea is that Hooks allow functional components to use powerful React features.`,
        createdAt: new Date().toISOString(),
        model: "Nova Standard",
      },
    ],
  },

  {
    id: "conversation-2",
    title: "Quantum computing basics",
    updatedAt: "Today",
    messages: [
      {
        id: "message-3",
        role: "user",
        content: "What is quantum computing?",
        createdAt: new Date().toISOString(),
      },
      {
        id: "message-4",
        role: "assistant",
        content: `## Quantum Computing

Quantum computing is a computing approach that uses principles of quantum mechanics.

Instead of classical bits that represent either **0 or 1**, quantum computers use **qubits**.

Qubits can exist in combinations of quantum states, which allows quantum computers to approach certain problems differently from classical computers.`,
        createdAt: new Date().toISOString(),
        model: "Nova Standard",
      },
    ],
  },

  {
    id: "conversation-3",
    title: "Python API help",
    updatedAt: "Yesterday",
    messages: [
      {
        id: "message-5",
        role: "user",
        content: "How can I build a REST API using Python?",
        createdAt: new Date().toISOString(),
      },
      {
        id: "message-6",
        role: "assistant",
        content: `## Building a Python REST API

You can use frameworks such as **FastAPI** or **Flask**.

FastAPI is a great choice when you want:

- Automatic API documentation
- Type hints
- Request validation
- High performance
- Async support

A basic FastAPI application looks like:

\`\`\`python
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Hello World"}
\`\`\``,
        createdAt: new Date().toISOString(),
        model: "Nova Fast",
      },
    ],
  },
];

export const mockResponses = [
  {
    content: `Absolutely. Let's break this down clearly.

The key idea is to understand the concept first and then look at a practical example.

### The simple explanation

Think of it as a system that takes your input, processes it, and produces a useful result.

The exact implementation depends on what you're trying to accomplish.

If you'd like, I can also explain this with a **real-world example** or a **step-by-step implementation**.`,
    model: "Nova Standard",
  },

  {
    content: `Sure! Here's a practical way to approach this.

### Step 1

Start by clearly defining the problem you want to solve.

### Step 2

Break the problem into smaller components.

### Step 3

Implement and test each component independently.

### Step 4

Connect everything together and verify the final result.

This approach makes complex problems much easier to understand and debug.`,
    model: "Nova Reasoning",
  },

  {
    content: `That's a great question.

Here's the short version:

> The best solution depends on your specific requirements, constraints, and expected result.

For most projects, I would recommend starting with a simple implementation and gradually adding complexity only when it's actually needed.

I can help you work through the entire process step by step.`,
    model: "Nova Standard",
  },
];