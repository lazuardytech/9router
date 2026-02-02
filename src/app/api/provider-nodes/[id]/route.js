import { NextResponse } from "next/server";
import { deleteProviderConnectionsByProvider, deleteProviderNode, getProviderConnections, getProviderNodeById, updateProviderConnection, updateProviderNode } from "@/models";

// PUT /api/provider-nodes/[id] - Update provider node
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, prefix, apiType, baseUrl } = body;
    const node = await getProviderNodeById(id);

    if (!node) {
      return NextResponse.json({ error: "Provider node not found" }, { status: 404 });
    }

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!prefix?.trim()) {
      return NextResponse.json({ error: "Prefix is required" }, { status: 400 });
    }

    if (!apiType || !["chat", "responses"].includes(apiType)) {
      return NextResponse.json({ error: "Invalid OpenAI compatible API type" }, { status: 400 });
    }

    if (!baseUrl?.trim()) {
      return NextResponse.json({ error: "Base URL is required" }, { status: 400 });
    }

    const updated = await updateProviderNode(id, {
      name: name.trim(),
      prefix: prefix.trim(),
      apiType,
      baseUrl: baseUrl.trim(),
    });

    const connections = await getProviderConnections({ provider: id });
    await Promise.all(connections.map((connection) => (
      updateProviderConnection(connection.id, {
        providerSpecificData: {
          ...(connection.providerSpecificData || {}),
          prefix: prefix.trim(),
          apiType,
          baseUrl: baseUrl.trim(),
          nodeName: updated.name,
        }
      })
    )));

    return NextResponse.json({ node: updated });
  } catch (error) {
    console.log("Error updating provider node:", error);
    return NextResponse.json({ error: "Failed to update provider node" }, { status: 500 });
  }
}

// DELETE /api/provider-nodes/[id] - Delete provider node and its connections
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const node = await getProviderNodeById(id);

    if (!node) {
      return NextResponse.json({ error: "Provider node not found" }, { status: 404 });
    }

    await deleteProviderConnectionsByProvider(id);
    await deleteProviderNode(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.log("Error deleting provider node:", error);
    return NextResponse.json({ error: "Failed to delete provider node" }, { status: 500 });
  }
}
