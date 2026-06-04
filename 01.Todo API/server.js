const http = require("http");
const url = require("url");
const crypto = require("crypto");

const PORT = 3000;

// In-memory data store
let todos = [
  {
    id: "1",
    title: "Learn Node.js",
    completed: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "2",
    title: "Build a Todo API",
    completed: true,
    createdAt: new Date().toISOString(),
  },
];

// Helper: parse JSON body from request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

// Helper: send JSON response
function send(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(data));
}

// Route handler: GET /todos
function getTodos(req, res, parsedUrl) {
  const { completed, search } = parsedUrl.query || {};

  let result = [...todos];

  // Filter by completed status
  if (completed !== undefined) {
    const isCompleted = completed === "true";
    result = result.filter((t) => t.completed === isCompleted);
  }

  // Search by title
  if (search) {
    const keyword = search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(keyword));
  }

  send(res, 200, { success: true, count: result.length, data: result });
}

// Route handler: GET /todos/:id
function getTodoById(req, res, id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) {
    return send(res, 404, { success: false, error: "Todo not found" });
  }
  send(res, 200, { success: true, data: todo });
}

// Route handler: POST /todos
async function createTodo(req, res) {
  const body = await parseBody(req);
  const { title } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return send(res, 400, {
      success: false,
      error: "Title is required and must be a non-empty string",
    });
  }

  const todo = {
    id: crypto.randomUUID(),
    title: title.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };

  todos.push(todo);
  send(res, 201, { success: true, data: todo });
}

// Route handler: PUT /todos/:id
async function updateTodo(req, res, id) {
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: "Todo not found" });
  }

  const body = await parseBody(req);
  const { title, completed } = body;

  if (title !== undefined && (typeof title !== "string" || !title.trim())) {
    return send(res, 400, {
      success: false,
      error: "Title must be a non-empty string",
    });
  }
  if (completed !== undefined && typeof completed !== "boolean") {
    return send(res, 400, {
      success: false,
      error: "Completed must be a boolean",
    });
  }

  const todo = { ...todos[index] };
  if (title !== undefined) todo.title = title.trim();
  if (completed !== undefined) todo.completed = completed;
  todo.updatedAt = new Date().toISOString();

  todos[index] = todo;
  send(res, 200, { success: true, data: todo });
}

// Route handler: DELETE /todos/:id
function deleteTodo(req, res, id) {
  const index = todos.findIndex((t) => t.id === id);
  if (index === -1) {
    return send(res, 404, { success: false, error: "Todo not found" });
  }

  const deleted = todos.splice(index, 1)[0];
  send(res, 200, { success: true, data: deleted });
}

// Route handler: DELETE /todos (clear all completed)
function clearCompleted(req, res) {
  const before = todos.length;
  todos = todos.filter((t) => !t.completed);
  const removed = before - todos.length;
  send(res, 200, {
    success: true,
    message: `Removed ${removed} completed todo(s)`,
    data: todos,
  });
}

// Main request handler
async function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight
  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  try {
    // Route matching
    // GET /todos
    if (method === "GET" && pathname === "/todos") {
      return getTodos(req, res, parsedUrl);
    }

    // GET /todos/:id
    const todoMatch = pathname.match(/^\/todos\/([a-f0-9-]+)$/);
    if (method === "GET" && todoMatch) {
      return getTodoById(req, res, todoMatch[1]);
    }

    // POST /todos
    if (method === "POST" && pathname === "/todos") {
      return await createTodo(req, res);
    }

    // PUT /todos/:id
    if (method === "PUT" && todoMatch) {
      return await updateTodo(req, res, todoMatch[1]);
    }

    // DELETE /todos/:id
    if (method === "DELETE" && todoMatch) {
      return deleteTodo(req, res, todoMatch[1]);
    }

    // DELETE /todos (clear completed)
    if (method === "DELETE" && pathname === "/todos") {
      return clearCompleted(req, res);
    }

    // 404 for unknown routes
    send(res, 404, { success: false, error: "Route not found" });
  } catch (err) {
    if (err.message === "Invalid JSON") {
      send(res, 400, { success: false, error: "Invalid JSON in request body" });
    } else {
      console.error("Server error:", err);
      send(res, 500, { success: false, error: "Internal server error" });
    }
  }
}

// Start server
const server = http.createServer(handler);

server.listen(PORT, () => {
  console.log(`\n  Todo API Server running at http://localhost:${PORT}`);
  console.log(`\n  Available endpoints:`);
  console.log(
    `    GET    /todos            - List all todos (query: ?completed=true|false&search=keyword)`,
  );
  console.log(`    GET    /todos/:id        - Get a todo by ID`);
  console.log(`    POST   /todos            - Create a todo (body: { title })`);
  console.log(
    `    PUT    /todos/:id        - Update a todo (body: { title?, completed? })`,
  );
  console.log(`    DELETE /todos/:id        - Delete a todo`);
  console.log(`    DELETE /todos            - Clear all completed todos\n`);
});
