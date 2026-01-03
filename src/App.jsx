import { useEffect, useState } from "react";

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
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
  const [toast, setToast] = useState({ show: false, message: "" });

  const currentReq = requests[activeIndex] || requests[0];

  const showToast = (msg) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;

    if (isSidebarOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isSidebarOpen]);

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
    if (requests.length === 1) {
      showToast("Error: At least one request is required!");
      return;
    }
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
    if (typeMapping[newType])
      currentHeaders["Content-Type"] = typeMapping[newType];
    else delete currentHeaders["Content-Type"];
    updateCurrentReq({
      bodyType: newType,
      headers: JSON.stringify(currentHeaders, null, 2),
    });
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
        if (currentReq.bodyType === "application/json")
          options.body = parseVariables(currentReq.bodyJson);
        else if (currentReq.bodyType === "multipart/form-data") {
          const formData = new FormData();
          currentReq.bodyFormData.forEach((item) => {
            if (item.key)
              formData.append(
                item.key,
                item.type === "file" ? item.value : parseVariables(item.value)
              );
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
    <div className="min-h-screen bg-[#0f1115] text-slate-300 flex font-sans overflow-x-hidden">
      {toast.message && toast.show && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-100 pointer-events-none">
          <div
            className={`
      flex items-center gap-3 px-5 py-3 rounded-xl bg-[#1a1d23] backdrop-blur-xl transition-all duration-500 ease-in-out border opacity-100 translate-y-0 scale-100         
      ${
        toast.message.includes("Error")
          ? "border-red-500/40"
          : "border-green-500/40"
      }
    `}
          >
            <div
              className={`shrink-0 flex items-center justify-center w-5 h-5 rounded-full 
      ${
        toast.message.includes("Error")
          ? "bg-red-500/20 text-red-400"
          : "bg-green-500/20 text-green-400"
      }`}
            >
              {toast.message.includes("Error") ? "!" : "✓"}
            </div>

            <span className="text-xs font-semibold text-white tracking-wide mr-2">
              {toast.message}
            </span>
          </div>
        </div>
      )}
      <div
        className={`lg:hidden fixed top-4 z-70 transition-all duration-300 ease-in-out ${
          isSidebarOpen ? "left-72 ml-4" : "left-4"
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2.5 bg-blue-600 text-white rounded shadow-lg active:scale-95 flex items-center justify-center min-w-10"
        >
          {isSidebarOpen ? "✕" : "☰"}
        </button>
      </div>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-transform duration-300 ease-in-out
        ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 border-b border-slate-800 flex items-center">
          <img src="/mojest.png" alt="mojest" className="h-8 w-auto" />
        </div>
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-66px)] p-4 space-y-2 custom-scrollbar">
          <div className="pb-3 border-b border-slate-800 flex justify-between items-center">
            <h2 className="text-white font-bold text-sm uppercase tracking-widest">
              Collections
            </h2>
            <button
              onClick={addNewRequest}
              className="w-8 h-8 bg-blue-600 hover:bg-blue-500 text-white rounded cursor-pointer"
            >
              +
            </button>
          </div>
          {requests.map((req, idx) => (
            <div
              key={req.id}
              onClick={() => setActiveIndex(idx)}
              className={`group p-4 text-sm transition-all relative 
                ${
                  activeIndex === idx
                    ? "bg-blue-600/10 rounded border border-blue-500/50"
                    : "hover:bg-slate-800/50 border border-transparent"
                }
                ${
                  activeIndex !== idx && idx !== requests.length - 1
                    ? " border-b-slate-800 rounded-none"
                    : ""
                }`}
            >
              <button
                onClick={(e) => deleteRequest(e, req.id, idx)}
                className="absolute top-4 right-3 opacity-0 group-hover:opacity-100 hover:text-red-500 p-1 cursor-pointer"
              >
                ✕
              </button>
              <div className="font-bold truncate pr-6">
                {editingId === req.id ? (
                  <input
                    autoFocus
                    className="bg-slate-950 outline-none w-full border border-blue-500 rounded px-1"
                    value={req.name}
                    onChange={(e) =>
                      updateReqById(req.id, { name: e.target.value })
                    }
                    onBlur={() => setEditingId(null)}
                  />
                ) : (
                  <span
                    onDoubleClick={() => setEditingId(req.id)}
                    title="Double click for edit"
                  >
                    {req.name || "Untitled Request"}
                  </span>
                )}
              </div>
              <div
                className={`mt-1 truncate font-bold text-[10px] ${
                  req.method === "GET"
                    ? "text-green-500"
                    : req.method === "POST"
                    ? "text-orange-500"
                    : req.method === "PUT"
                    ? "text-yellow-500"
                    : req.method === "PATCH"
                    ? "text-blue-500"
                    : req.method === "DELETE"
                    ? "text-red-500"
                    : "text-white"
                }`}
              >
                {req.method}
              </div>
              <div className="text-xs italic truncate opacity-80">
                {req.endpoint || "/"}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 p-2 lg:p-10 overflow-y-auto bg-[#0f1115]">
        {currentReq && (
          <div className="max-w-7xl mx-auto space-y-8 pt-14 lg:pt-0">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-slate-900/40 p-5 rounded border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                    Environment
                  </span>
                  <button
                    onClick={addVariable}
                    className="text-[10px] bg-blue-600/20 text-blue-400 px-3 py-1 rounded font-bold hover:bg-blue-600/30 transition-all cursor-pointer"
                  >
                    + ADD
                  </button>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                  {variables.map((v, i) => (
                    <div
                      key={i}
                      className="flex gap-2 items-center bg-slate-950/50 p-1.5 rounded border border-slate-800/50"
                    >
                      <input
                        placeholder="Key"
                        className="w-1/3 bg-transparent px-3 text-[11px] outline-none border-r border-slate-800 text-blue-300 placeholder:text-blue-300/65 font-mono"
                        value={v.key}
                        onChange={(e) =>
                          updateVariable(i, "key", e.target.value)
                        }
                      />
                      <input
                        placeholder="Value"
                        className="flex-1 bg-transparent px-3 text-[11px] outline-none text-white placeholder:text-white/65 font-mono"
                        value={v.value}
                        onChange={(e) =>
                          updateVariable(i, "value", e.target.value)
                        }
                      />
                      <button
                        onClick={() => removeVariable(i)}
                        className="px-3 text-slate-600 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/40 p-5 rounded border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest cursor-pointer">
                    Global Auth
                  </span>
                  <button
                    onClick={addGlobalHeader}
                    className="text-[10px] bg-emerald-600/20 text-emerald-400 px-3 py-1 rounded font-bold hover:bg-emerald-600/30 transition-all"
                  >
                    + ADD
                  </button>
                </div>
                <div className="space-y-2 max-h-36 overflow-y-auto pr-2 custom-scrollbar">
                  {globalHeaders.map((h, i) => (
                    <div
                      key={i}
                      className="flex gap-2 items-center bg-slate-950/50 p-1.5 rounded border border-slate-800/50"
                    >
                      <input
                        placeholder="Key"
                        className="w-1/3 bg-transparent px-3 text-[11px] outline-none border-r border-slate-800 text-emerald-300 placeholder:text-emerald-300/65 font-mono"
                        value={h.key}
                        onChange={(e) =>
                          updateGlobalHeader(i, "key", e.target.value)
                        }
                      />
                      <input
                        placeholder="Value"
                        className="flex-1 bg-transparent px-3 text-[11px] outline-none text-white placeholder:text-white/65 font-mono"
                        value={h.value}
                        onChange={(e) =>
                          updateGlobalHeader(i, "value", e.target.value)
                        }
                      />
                      <button
                        onClick={() => removeGlobalHeader(i)}
                        className="px-3 text-slate-600 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 bg-slate-900/80 p-4 rounded border border-slate-800 shadow-2xl">
              <div className="flex gap-2">
                <select
                  className="bg-slate-800 rounded px-6 py-4 text-orange-400 font-black outline-none cursor-pointer"
                  value={currentReq.method}
                  onChange={(e) => updateCurrentReq({ method: e.target.value })}
                >
                  {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="lg:hidden flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 px-10 py-4 min-w-14 rounded font-black text-white active:scale-95 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? "SENDING..." : "SEND"}
                </button>
              </div>
              <input
                className="flex-1 bg-slate-800 rounded px-6 py-4 text-white font-mono text-sm outline-none placeholder:text-slate-600"
                placeholder="Enter endpoint URL"
                value={currentReq.endpoint}
                onChange={(e) => updateCurrentReq({ endpoint: e.target.value })}
              />
              <button
                onClick={handleSend}
                disabled={loading}
                className="hidden lg:block bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 px-10 py-4 min-w-14 rounded font-black text-white active:scale-95 cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                {loading ? "SENDING..." : "SEND"}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col gap-6">
                <div className="bg-slate-900/40 rounded border border-slate-800 overflow-hidden h-48 flex flex-col">
                  <div className="bg-slate-800/50 px-6 py-3 text-[10px] font-black text-slate-500 uppercase">
                    Headers (JSON)
                  </div>
                  <textarea
                    className="flex-1 p-6 bg-transparent text-sm font-mono text-blue-300 outline-none resize-none"
                    value={currentReq.headers}
                    onChange={(e) =>
                      updateCurrentReq({ headers: e.target.value })
                    }
                  />
                </div>
                <div className="bg-slate-900/40 rounded border border-slate-800 overflow-hidden min-h-70 flex flex-col">
                  <div className="bg-slate-800/50 px-6 py-3 text-[10px] font-black text-slate-500 flex justify-between items-center">
                    <span className="uppercase">Body Payload</span>
                    <select
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-1 text-[10px] text-white font-bold outline-none"
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
                  <div className="flex-1 p-6 max-h-56 overflow-auto custom-scrollbar">
                    {currentReq.bodyType === "application/json" ? (
                      <textarea
                        className="w-full h-full bg-transparent text-sm font-mono text-emerald-300 outline-none resize-none"
                        value={currentReq.bodyJson}
                        onChange={(e) =>
                          updateCurrentReq({ bodyJson: e.target.value })
                        }
                      />
                    ) : currentReq.bodyType === "none" ? (
                      <div className="h-full flex items-center justify-center text-slate-600 italic text-xs uppercase tracking-widest">
                        No Body Required
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {currentReq.bodyFormData.map((row, idx) => (
                          <div
                            key={idx}
                            className="flex gap-2 bg-slate-950/80 p-1.5 rounded border border-slate-800"
                          >
                            {currentReq.bodyType ===
                            "application/x-www-form-urlencoded" ? null : (
                              <select
                                className="bg-slate-900 text-[10px] text-slate-400 outline-none px-2 border-r border-slate-800"
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
                              className="w-1/3 bg-transparent border-r border-slate-800 px-3 text-xs text-white placeholder:text-white/65 font-mono outline-none"
                              value={row.key}
                              onChange={(e) => {
                                const newRows = [...currentReq.bodyFormData];
                                newRows[idx].key = e.target.value;
                                updateCurrentReq({ bodyFormData: newRows });
                              }}
                            />
                            {row.type === "file" ? (
                              <div className="flex-1 flex items-center px-3 overflow-hidden">
                                <label className="flex items-center gap-2 group/file w-full">
                                  <input
                                    type="file"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files[0];
                                      if (!file) return;
                                      const newRows = [
                                        ...currentReq.bodyFormData,
                                      ];
                                      newRows[idx].value = file;
                                      updateCurrentReq({
                                        bodyFormData: newRows,
                                      });
                                    }}
                                  />

                                  {!(row.value instanceof File) ? (
                                    <div className="bg-slate-800 group-hover/file:bg-slate-700 border border-slate-700 px-2 py-1 rounded-xs text-[9px] font-bold text-slate-300 transition-colors uppercase tracking-tighter">
                                      Choose File
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-xs w-full">
                                      <span className="text-[10px]">📄</span>

                                      <span className="text-[10px] text-emerald-400 truncate flex-1 font-medium italic">
                                        {row.value.name}
                                      </span>

                                      <button
                                        className="text-emerald-400 hover:text-red-500 text-[10px] transition-colors ml-1 p-0.5 cursor-pointer"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          const newRows = [
                                            ...currentReq.bodyFormData,
                                          ];
                                          newRows[idx].value = "";
                                          updateCurrentReq({
                                            bodyFormData: newRows,
                                          });
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  )}

                                  {!(row.value instanceof File) && (
                                    <span className="text-[9px] text-slate-600 italic">
                                      No file selected
                                    </span>
                                  )}
                                </label>
                              </div>
                            ) : (
                              <input
                                placeholder="Value"
                                className="flex-1 bg-transparent px-3 text-xs text-emerald-300 placeholder:text-emerald-300/65 font-mono outline-none"
                                value={row.value}
                                onChange={(e) => {
                                  const newRows = [...currentReq.bodyFormData];
                                  newRows[idx].value = e.target.value;
                                  updateCurrentReq({ bodyFormData: newRows });
                                }}
                              />
                            )}
                            <button
                              className="px-3 text-slate-700 hover:text-red-500"
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
                          className="text-[10px] text-blue-500 font-black tracking-widest hover:underline px-2 cursor-pointer"
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
              </div>
              <div className="bg-slate-950 rounded border border-slate-800 flex flex-col shadow-inner">
                <div className="bg-slate-900/80 px-8 py-4 border-b border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    Response
                  </span>
                  <div className="flex gap-4">
                    {currentReq.response && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(
                            JSON.stringify(currentReq.response, null, 2)
                          );
                          showToast("Response copied to clipboard!");
                        }}
                        className="text-[10px] font-bold text-blue-500 uppercase hover:text-blue-400 cursor-pointer"
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
                <div className="flex-1 p-8 font-mono text-sm text-emerald-400 leading-relaxed max-h-110 overflow-auto">
                  {currentReq.response ? (
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(currentReq.response, null, 2)}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-700 italic text-xs tracking-widest uppercase">
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
