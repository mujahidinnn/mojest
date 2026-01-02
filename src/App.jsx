import { useEffect, useState } from "react";

export default function App() {
  const [variables, setVariables] = useState([
    { key: "baseUrl", value: "https://jsonplaceholder.typicode.com" },
    { key: "userId", value: "1" },
  ]);

  const [globalHeaders, setGlobalHeaders] = useState([
    { key: "Authorization", value: "Bearer YOUR_TOKEN" },
  ]);

  const [requests, setRequests] = useState([
    {
      id: 1,
      name: "Get User Data",
      endpoint: "/users/{{userId}}",
      method: "GET",
      bodyType: "none",
      headers: "{}",
      useGlobalAuth: true,
      bodyJson: "{}",
      bodyFormData: [{ key: "", value: "", type: "text" }],
      response: null,
      status: null,
    },
  ]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const currentReq = requests[activeIndex] || requests[0];

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const parseVariables = (text) => {
    if (typeof text !== "string") return text;
    const varLookup = variables.reduce((acc, curr) => {
      if (curr.key) acc[curr.key] = curr.value;
      return acc;
    }, {});

    return text.replace(/\{\{(.*?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      return varLookup[trimmedKey] !== undefined
        ? varLookup[trimmedKey]
        : match;
    });
  };

  const updateVariable = (index, field, value) => {
    const newVars = [...variables];
    newVars[index][field] = value;
    setVariables(newVars);
  };
  const addVariable = () =>
    setVariables([...variables, { key: "", value: "" }]);
  const removeVariable = (index) =>
    setVariables(variables.filter((_, i) => i !== index));

  const updateGlobalHeader = (index, field, value) => {
    const newHeaders = [...globalHeaders];
    newHeaders[index][field] = value;
    setGlobalHeaders(newHeaders);
  };
  const addGlobalHeader = () =>
    setGlobalHeaders([...globalHeaders, { key: "", value: "" }]);
  const removeGlobalHeader = (index) =>
    setGlobalHeaders(globalHeaders.filter((_, i) => i !== index));

  const updateCurrentReq = (newData) => {
    const updated = [...requests];
    updated[activeIndex] = { ...updated[activeIndex], ...newData };
    setRequests(updated);
  };

  const updateReqById = (id, newData) => {
    setRequests(
      requests.map((req) => (req.id === id ? { ...req, ...newData } : req))
    );
  };

  const addNewRequest = () => {
    const newReq = {
      id: Date.now(),
      name: "New Request",
      endpoint: "",
      method: "GET",
      bodyType: "none",
      headers: "{}",
      useGlobalAuth: true,
      bodyJson: "{}",
      bodyFormData: [{ key: "", value: "", type: "text" }],
      response: null,
      status: null,
    };
    setRequests([...requests, newReq]);
    setActiveIndex(requests.length);
  };

  const deleteRequest = (e, id, index) => {
    e.stopPropagation();
    if (requests.length === 1) return alert("Minimal harus ada satu request!");
    const newRequests = requests.filter((r) => r.id !== id);
    setRequests(newRequests);
    if (index <= activeIndex && activeIndex > 0)
      setActiveIndex(activeIndex - 1);
  };

  const handleBodyTypeChange = (newType) => {
    let currentHeaders = {};
    try {
      currentHeaders = JSON.parse(currentReq.headers || "{}");
    } catch (e) {
      currentHeaders = {};
    }
    const typeMapping = {
      "application/json": "application/json",
      "application/x-www-form-urlencoded": "application/x-www-form-urlencoded",
      "multipart/form-data": null,
      none: null,
    };
    const targetType = typeMapping[newType];
    if (targetType) currentHeaders["Content-Type"] = targetType;
    else delete currentHeaders["Content-Type"];

    updateCurrentReq({
      bodyType: newType,
      headers: JSON.stringify(currentHeaders, null, 2),
    });
  };

  const handleToggleGlobalAuth = (checked) => {
    let localHeaders = {};
    try {
      localHeaders = JSON.parse(currentReq.headers || "{}");
    } catch (e) {
      localHeaders = {};
    }

    if (checked) {
      const globalObj = globalHeaders.reduce((acc, curr) => {
        if (curr.key) acc[curr.key] = curr.value;
        return acc;
      }, {});
      updateCurrentReq({
        useGlobalAuth: true,
        headers: JSON.stringify({ ...globalObj, ...localHeaders }, null, 2),
      });
    } else {
      const globalKeys = globalHeaders.map((h) => h.key);
      const filtered = { ...localHeaders };
      globalKeys.forEach((key) => delete filtered[key]);
      updateCurrentReq({
        useGlobalAuth: false,
        headers: JSON.stringify(filtered, null, 2),
      });
    }
  };

  const handleSend = async () => {
    if (!currentReq) return;
    setLoading(true);
    updateCurrentReq({ response: null, status: null });
    try {
      let localHeaders = {};
      try {
        localHeaders = JSON.parse(parseVariables(currentReq.headers || "{}"));
      } catch (e) {
        localHeaders = {};
      }

      let finalHeaders = { ...localHeaders };
      if (currentReq.useGlobalAuth) {
        globalHeaders.forEach((h) => {
          if (h.key) finalHeaders[h.key] = parseVariables(h.value);
        });
      }

      const options = { method: currentReq.method, headers: finalHeaders };

      if (currentReq.method !== "GET" && currentReq.bodyType !== "none") {
        if (currentReq.bodyType === "application/json") {
          options.body = parseVariables(currentReq.bodyJson);
        } else if (currentReq.bodyType === "multipart/form-data") {
          const formData = new FormData();
          currentReq.bodyFormData.forEach((item) => {
            if (item.key) formData.append(item.key, parseVariables(item.value));
          });
          options.body = formData;
          delete options.headers["Content-Type"];
        } else if (
          currentReq.bodyType === "application/x-www-form-urlencoded"
        ) {
          const urlEncoded = new URLSearchParams();
          currentReq.bodyFormData.forEach((item) => {
            if (item.key)
              urlEncoded.append(item.key, parseVariables(item.value));
          });
          options.body = urlEncoded;
        }
      }

      const rawBase = parseVariables("{{baseUrl}}");
      const processedEndpoint = parseVariables(currentReq.endpoint);
      const fullUrl = `${rawBase.replace(
        /\/$/,
        ""
      )}/${processedEndpoint.replace(/^\//, "")}`;

      const start = performance.now();
      const res = await fetch(fullUrl, options);
      const end = performance.now();

      const contentType = res.headers.get("content-type");
      let data =
        contentType && contentType.includes("application/json")
          ? await res.json()
          : await res.text();

      updateCurrentReq({
        response: data,
        status: {
          code: res.status,
          text: res.statusText,
          time: Math.round(end - start),
        },
      });
    } catch (err) {
      updateCurrentReq({
        response: { error: err.message },
        status: { code: "Error", text: "Fail", time: 0 },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-slate-300 flex font-sans">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-3">
          <img src="/mojest.png" alt="mojest" className="w-32 h-auto" />
        </div>
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-white font-bold text-sm uppercase tracking-widest">
            Collections
          </h2>
          <button
            onClick={addNewRequest}
            className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-transform active:scale-90"
          >
            +
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
          {requests.map((req, idx) => (
            <div
              key={req.id}
              onClick={() => setActiveIndex(idx)}
              className={`group p-3 rounded-xl text-sm border transition-all relative cursor-pointer ${
                activeIndex === idx
                  ? "bg-blue-600/10 border-blue-500/50 text-blue-400"
                  : "hover:bg-slate-800 border-transparent text-slate-500"
              }`}
            >
              <button
                onClick={(e) => deleteRequest(e, req.id, idx)}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 transition-opacity"
              >
                ✕
              </button>
              <div className="font-bold truncate pr-4 text-xs">
                {editingId === req.id ? (
                  <input
                    autoFocus
                    className="bg-slate-950 outline-none w-full border border-blue-500 rounded px-1"
                    value={req.name}
                    onChange={(e) =>
                      updateReqById(req.id, { name: e.target.value })
                    }
                    onBlur={() => setEditingId(null)}
                    onKeyDown={(e) => e.key === "Enter" && setEditingId(null)}
                  />
                ) : (
                  <span onDoubleClick={() => setEditingId(req.id)}>
                    {req.name || "Untitled Request"}
                  </span>
                )}
              </div>
              <div className="text-[10px] mt-1 italic opacity-60 truncate">
                {req.endpoint || "/"}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-8 overflow-y-auto bg-[#0f1115]">
        {!currentReq ? (
          <div className="h-full flex items-center justify-center text-slate-600 italic">
            Pilih atau buat request baru
          </div>
        ) : (
          <div className="max-w-8xl mx-auto space-y-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    Environment Variables
                  </span>
                  <button
                    onClick={addVariable}
                    className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-600/40 transition-colors font-bold"
                  >
                    + ADD
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {variables.map((v, i) => (
                    <div
                      key={i}
                      className="flex gap-2 items-center bg-slate-950 p-1 rounded border border-slate-800"
                    >
                      <input
                        placeholder="Key"
                        className="w-1/3 bg-transparent px-2 text-[11px] outline-none border-r border-slate-800 text-blue-300 placeholder:text-blue-700 font-mono"
                        value={v.key}
                        onChange={(e) =>
                          updateVariable(i, "key", e.target.value)
                        }
                      />
                      <input
                        placeholder="Value"
                        className="flex-1 bg-transparent px-2 text-[11px] outline-none text-white placeholder:text-slate-500 font-mono"
                        value={v.value}
                        onChange={(e) =>
                          updateVariable(i, "value", e.target.value)
                        }
                      />
                      <button
                        onClick={() => removeVariable(i)}
                        className="px-2 text-slate-700 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
                    Global Authorize
                  </span>
                  <button
                    onClick={addGlobalHeader}
                    className="text-[10px] bg-emerald-600/20 text-emerald-400 px-2 py-1 rounded hover:bg-emerald-600/40 transition-colors font-bold"
                  >
                    + ADD
                  </button>
                </div>
                <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                  {globalHeaders.map((h, i) => (
                    <div
                      key={i}
                      className="flex gap-2 items-center bg-slate-950 p-1 rounded border border-slate-800"
                    >
                      <input
                        placeholder="Header Key"
                        className="w-1/3 bg-transparent px-2 text-[11px] outline-none border-r border-slate-800 text-emerald-300 placeholder:text-emerald-600 font-mono"
                        value={h.key}
                        onChange={(e) =>
                          updateGlobalHeader(i, "key", e.target.value)
                        }
                      />
                      <input
                        placeholder="Header Value"
                        className="flex-1 bg-transparent px-2 text-[11px] outline-none text-white placeholder:text-slate-500 font-mono"
                        value={h.value}
                        onChange={(e) =>
                          updateGlobalHeader(i, "value", e.target.value)
                        }
                      />
                      <button
                        onClick={() => removeGlobalHeader(i)}
                        className="px-2 text-slate-700 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <hr className="border-slate-800" />

            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {currentReq.name}
              </h1>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="auth-check"
                  checked={currentReq.useGlobalAuth}
                  onChange={(e) => handleToggleGlobalAuth(e.target.checked)}
                  className="cursor-pointer accent-blue-500"
                />
                <label
                  htmlFor="auth-check"
                  className="text-[10px] font-bold text-slate-500 uppercase tracking-widest cursor-pointer"
                >
                  Use Global Auth
                </label>
              </div>
            </div>

            <div className="flex gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 shadow-xl">
              <select
                className="bg-slate-800 rounded-xl px-4 py-3 text-orange-400 font-bold outline-none cursor-pointer"
                value={currentReq.method}
                onChange={(e) => updateCurrentReq({ method: e.target.value })}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <input
                className="flex-1 bg-slate-800 rounded-xl px-4 text-white font-mono text-sm outline-none placeholder:text-slate-600"
                placeholder="Endpoint (ex: /users/{{userId}})"
                value={currentReq.endpoint}
                onChange={(e) => updateCurrentReq({ endpoint: e.target.value })}
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 px-8 py-3 rounded-xl font-bold text-white transition-all active:scale-95"
              >
                {loading ? "SENDING..." : "SEND"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-120">
              <div className="flex flex-col gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="bg-slate-800/50 px-4 py-2 text-xs font-bold text-slate-500 flex justify-between items-center">
                    <span>HEADERS (JSON)</span>
                    {currentReq.bodyType === "multipart/form-data" && (
                      <span className="text-[9px] text-blue-400 font-bold uppercase tracking-tighter italic opacity-80">
                        Auto-handling multipart
                      </span>
                    )}
                  </div>
                  <textarea
                    className="flex-1 p-4 bg-transparent text-sm font-mono text-blue-300 outline-none resize-none"
                    value={currentReq.headers}
                    onChange={(e) =>
                      updateCurrentReq({ headers: e.target.value })
                    }
                    placeholder='{"Custom-Header": "value"}'
                  />
                </div>

                <div className="flex-1 flex flex-col bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="bg-slate-800/50 px-4 py-2 text-xs font-bold text-slate-500 flex justify-between items-center">
                    <span>BODY TYPE</span>
                    <select
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[10px] text-white font-bold"
                      value={currentReq.bodyType}
                      onChange={(e) => handleBodyTypeChange(e.target.value)}
                    >
                      <option value="none">none</option>
                      <option value="application/json">application/json</option>
                      <option value="multipart/form-data">
                        multipart/form-data
                      </option>
                      <option value="application/x-www-form-urlencoded">
                        application/x-www-form-urlencoded
                      </option>
                    </select>
                  </div>
                  {currentReq.bodyType === "application/json" ? (
                    <textarea
                      className="w-full p-4 h-full bg-transparent text-sm font-mono text-emerald-300 outline-none resize-none"
                      value={currentReq.bodyJson}
                      onChange={(e) =>
                        updateCurrentReq({ bodyJson: e.target.value })
                      }
                      placeholder='{"key": "value"}'
                    />
                  ) : currentReq.bodyType === "none" ? (
                    <div className="h-full flex items-center justify-center text-slate-500 italic text-[10px] tracking-widest uppercase">
                      No body payload
                    </div>
                  ) : (
                    <div className="flex-1 p-4 overflow-y-auto space-y-2 custom-scrollbar">
                      {currentReq.bodyFormData.map((row, idx) => (
                        <div
                          key={idx}
                          className="flex gap-2 bg-slate-950 rounded p-1 border border-slate-800 items-center"
                        >
                          {currentReq.bodyType ===
                          "application/x-www-form-urlencoded" ? null : (
                            <select
                              className="bg-slate-900 text-[10px] text-slate-400 outline-none px-1 border-r border-slate-800 h-6"
                              value={row.type || "text"}
                              onChange={(e) => {
                                const newRows = [...currentReq.bodyFormData];
                                newRows[idx].type = e.target.value;
                                newRows[idx].value = "";
                                updateCurrentReq({ bodyFormData: newRows });
                              }}
                            >
                              <option value="text">Text</option>
                              <option value="file">File</option>
                            </select>
                          )}

                          <input
                            placeholder="Key"
                            className="w-1/3 bg-transparent border-r border-slate-800 px-2 text-xs outline-none text-white placeholder:text-slate-600"
                            value={row.key}
                            onChange={(e) => {
                              const newRows = [...currentReq.bodyFormData];
                              newRows[idx].key = e.target.value;
                              updateCurrentReq({ bodyFormData: newRows });
                            }}
                          />

                          {row.type === "file" ? (
                            <input
                              type="file"
                              className="flex-1 bg-transparent px-2 text-[10px] text-emerald-300 outline-none"
                              onChange={(e) => {
                                const newRows = [...currentReq.bodyFormData];
                                newRows[idx].value = e.target.files[0];
                                updateCurrentReq({ bodyFormData: newRows });
                              }}
                            />
                          ) : (
                            <input
                              placeholder="Value"
                              className="flex-1 bg-transparent px-2 text-xs text-emerald-300 placeholder:text-emerald-700 outline-none"
                              value={row.value}
                              onChange={(e) => {
                                const newRows = [...currentReq.bodyFormData];
                                newRows[idx].value = e.target.value;
                                updateCurrentReq({ bodyFormData: newRows });
                              }}
                            />
                          )}

                          <button
                            className="px-2 text-slate-700 hover:text-red-500 transition-colors"
                            onClick={() =>
                              updateCurrentReq({
                                bodyFormData: currentReq.bodyFormData.filter(
                                  (_, i) => i !== idx
                                ),
                              })
                            }
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      <button
                        className="text-[10px] text-blue-500 font-bold hover:underline mt-2"
                        onClick={() =>
                          updateCurrentReq({
                            bodyFormData: [
                              ...currentReq.bodyFormData,
                              { key: "", value: "", type: "text" },
                            ],
                          })
                        }
                      >
                        + ADD PARAMETER
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-inner">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Response
                  </span>
                  <div className="flex gap-4">
                    {currentReq.response && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(currentReq.response, null, 2)
                          );
                          alert("Copied!");
                        }}
                        className="text-[10px] font-bold text-blue-500 uppercase hover:text-blue-400"
                      >
                        Copy
                      </button>
                    )}
                    {currentReq.status && (
                      <div className="flex gap-3 text-[10px] font-bold">
                        <span
                          className={
                            currentReq.status.code < 400
                              ? "text-emerald-500"
                              : "text-red-500"
                          }
                        >
                          {currentReq.status.code} {currentReq.status.text}
                        </span>
                        <span className="text-blue-500">
                          {currentReq.status.time}ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-1 p-4 overflow-auto font-mono text-sm text-emerald-400 custom-scrollbar">
                  {currentReq.response ? (
                    <pre>{JSON.stringify(currentReq.response, null, 2)}</pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 italic">
                      Waiting for request...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
