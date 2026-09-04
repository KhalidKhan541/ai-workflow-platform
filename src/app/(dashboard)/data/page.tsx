"use client";

import React, { useState, useMemo } from "react";
import {
  Plus, Search, Download, Upload, Filter, RefreshCw, Edit3,
  Trash2, Save, X, Check, Database, Table, Columns, ArrowUpDown,
  MoreHorizontal, Eye, Copy, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DataRow {
  id: string;
  name: string;
  email: string;
  company: string;
  status: string;
  value: number;
  lastActive: string;
}

const initialData: DataRow[] = [
  { id: "1", name: "Alice Johnson", email: "alice@example.com", company: "Acme Corp", status: "active", value: 12500, lastActive: "2024-03-10" },
  { id: "2", name: "Bob Smith", email: "bob@techco.com", company: "TechCo", status: "active", value: 8300, lastActive: "2024-03-09" },
  { id: "3", name: "Carol White", email: "carol@startup.io", company: "StartupIO", status: "inactive", value: 4200, lastActive: "2024-02-15" },
  { id: "4", name: "David Brown", email: "david@enterprise.com", company: "Enterprise Inc", status: "active", value: 28900, lastActive: "2024-03-10" },
  { id: "5", name: "Eva Martinez", email: "eva@global.com", company: "Global LLC", status: "lead", value: 6700, lastActive: "2024-03-08" },
  { id: "6", name: "Frank Lee", email: "frank@bigdata.com", company: "BigData Co", status: "active", value: 15400, lastActive: "2024-03-07" },
  { id: "7", name: "Grace Kim", email: "grace@innovate.com", company: "Innovate Labs", status: "active", value: 9100, lastActive: "2024-03-10" },
  { id: "8", name: "Henry Chen", email: "henry@digital.com", company: "Digital First", status: "lead", value: 3800, lastActive: "2024-03-06" },
];

const schemas = [
  { id: "1", name: "contacts", fields: ["id", "name", "email", "company", "status", "value", "lastActive"], recordCount: 1247, lastUpdated: "2024-03-10" },
  { id: "2", name: "workflows", fields: ["id", "name", "status", "triggerType", "stepsCount"], recordCount: 24, lastUpdated: "2024-03-10" },
  { id: "3", name: "executions", fields: ["id", "workflowId", "status", "startedAt", "completedAt", "duration"], recordCount: 12847, lastUpdated: "2024-03-10" },
];

const columns = [
  { key: "name", label: "Name", type: "text" as const, editable: true },
  { key: "email", label: "Email", type: "text" as const, editable: true },
  { key: "company", label: "Company", type: "text" as const, editable: true },
  { key: "status", label: "Status", type: "select" as const, editable: true, options: ["active", "inactive", "lead"] },
  { key: "value", label: "Value", type: "number" as const, editable: true },
  { key: "lastActive", label: "Last Active", type: "text" as const, editable: false },
];

export default function DataPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  React.useEffect(() => {
    const t = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(t);
  }, []);

  const filtered = useMemo(() => {
    let result = data.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(search.toLowerCase()))
    );
    if (sortCol) {
      result.sort((a, b) => {
        const va = a[sortCol as keyof DataRow] ?? "";
        const vb = b[sortCol as keyof DataRow] ?? "";
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortCol, sortDir]);

  const startEdit = (rowId: string, col: string, val: string) => {
    setEditingCell({ rowId, col });
    setEditValue(val);
  };

  const saveEdit = (rowId: string, col: string) => {
    setData((prev) => prev.map((r) => r.id === rowId ? { ...r, [col]: col === "value" ? Number(editValue) : editValue } : r));
    setEditingCell(null);
  };

  const cancelEdit = () => setEditingCell(null);

  const toggleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]" role="status" aria-label="Loading data">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Data Management</h1>
          <p className="text-muted-foreground mt-1">Manage, view, and transform your data</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm"><Upload className="h-4 w-4 mr-2" /> Import</Button>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" /> Export</Button>
          <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Add Record</Button>
        </div>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table"><Table className="h-4 w-4 mr-1 inline" /> Table View</TabsTrigger>
          <TabsTrigger value="schema"><Columns className="h-4 w-4 mr-1 inline" /> Schema</TabsTrigger>
        </TabsList>

        {/* Table View */}
        <TabsContent value="table" className="mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" aria-label="Search records" />
                </div>
                <span className="text-sm text-muted-foreground">{filtered.length} records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {columns.map((col) => (
                        <th key={col.key} className="text-left py-3 px-3 font-medium text-muted-foreground">
                          <button
                            className="flex items-center gap-1 hover:text-foreground transition-colors"
                            onClick={() => toggleSort(col.key)}
                            aria-label={`Sort by ${col.label}`}
                          >
                            {col.label}
                            <ArrowUpDown className="h-3 w-3" />
                          </button>
                        </th>
                      ))}
                      <th className="py-3 px-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row) => (
                      <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        {columns.map((col) => {
                          const isEditing = editingCell?.rowId === row.id && editingCell?.col === col.key;
                          const val = row[col.key as keyof DataRow];
                          return (
                            <td key={col.key} className="py-3 px-3">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    className="h-8 text-xs"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(row.id, col.key); if (e.key === "Escape") cancelEdit(); }}
                                    aria-label={`Edit ${col.label}`}
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(row.id, col.key)} aria-label="Save">
                                    <Check className="h-3 w-3 text-green-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit} aria-label="Cancel">
                                    <X className="h-3 w-3 text-red-500" />
                                  </Button>
                                </div>
                              ) : (
                                <span
                                  className={`${col.editable ? "cursor-pointer hover:text-primary" : ""} ${col.key === "status" ? "capitalize" : ""} ${col.key === "value" ? "font-mono" : ""}`}
                                  onClick={() => col.editable && startEdit(row.id, col.key, String(val))}
                                  role={col.editable ? "button" : undefined}
                                  tabIndex={col.editable ? 0 : undefined}
                                  onKeyDown={(e) => col.editable && (e.key === "Enter" || e.key === " ") && startEdit(row.id, col.key, String(val))}
                                >
                                  {col.key === "value" ? `$${Number(val).toLocaleString()}` : String(val)}
                                </span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-3 px-3">
                          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schema Tab */}
        <TabsContent value="schema" className="mt-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schemas.map((schema) => (
              <Card key={schema.id}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{schema.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">{schema.recordCount.toLocaleString()} records</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {schema.fields.map((field) => (
                      <div key={field} className="flex items-center justify-between py-1 px-2 rounded bg-muted/50 text-sm">
                        <span className="font-mono text-xs">{field}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Last updated: {schema.lastUpdated}</p>
                </CardContent>
              </Card>
            ))}
            <Card className="border-dashed hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="py-12 flex flex-col items-center justify-center">
                <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Create new schema</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
