import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";
import { prisma } from "@/lib/db";
import { verifySession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(["pdf", "txt"]);

function getStoragePath(): string {
  return (
    process.env.RESOURCE_STORAGE_PATH ||
    path.join(os.homedir(), ".local", "ems-dashboard", "resources")
  );
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v1.x: default export is a function that takes a Buffer
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

export async function POST(request: Request) {
  try {
    // Auth check
    const session = await verifySession();
    if (!session || !hasPermission(session.role, "manage_resources")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = (formData.get("title") as string) || "";
    const description = (formData.get("description") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_TYPES.has(ext)) {
      return NextResponse.json(
        { error: `Invalid file type ".${ext}". Allowed: PDF, TXT` },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum size is 10MB.` }, { status: 400 });
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text content
    let textContent = "";
    if (ext === "pdf") {
      textContent = await extractTextFromPdf(buffer);
    } else {
      // txt
      textContent = buffer.toString("utf-8");
    }

    // Save file to storage
    const storagePath = getStoragePath();
    await mkdir(storagePath, { recursive: true });

    const uniqueName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const filePath = path.join(storagePath, uniqueName);
    await writeFile(filePath, buffer);

    // Create database record
    const doc = await prisma.resourceDocument.create({
      data: {
        title: title || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        fileType: ext,
        fileSize: file.size,
        filePath: uniqueName, // store relative name, not full path
        textContent,
        textLength: textContent.length,
        description: description || null,
        uploadedById: session.userId,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        action: "CREATE",
        entity: "ResourceDocument",
        entityId: doc.id,
        details: `Uploaded resource document "${doc.title}" (${ext}, ${file.size} bytes, ${textContent.length} chars extracted)`,
        actorId: session.userId,
        actorType: "user",
      },
    });

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        textLength: doc.textLength,
        createdAt: doc.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Resource upload error:", err);
    return NextResponse.json({ error: "Failed to upload resource document" }, { status: 500 });
  }
}
