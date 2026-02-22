from fastapi import APIRouter, HTTPException, UploadFile, File

from models.schemas import (
    GDriveFolderRequest,
    GDriveFolderResponse,
    GDriveFileResult,
    IngestURLRequest,
    IngestURLResponse,
)
from services.ingestion.url_fetcher import fetch_url, is_gdrive_url
from services.ingestion.gdrive_client import (
    extract_gdrive_folder_id,
    list_folder_files,
    fetch_gdrive_file,
)

router = APIRouter()


@router.post("/ingest-url", response_model=IngestURLResponse)
async def ingest_url(request: IngestURLRequest):
    """Fetch a URL and return its readable text content.

    If the URL points to Google Drive the response will indicate
    ``source_type`` = ``"gdrive"`` so the caller can redirect to the
    dedicated Google Drive ingestion endpoint.
    """
    try:
        result = await fetch_url(request.url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=502, detail=f"Failed to fetch URL: {exc}"
        )

    return IngestURLResponse(**result)


@router.post("/ingest-gdrive-folder", response_model=GDriveFolderResponse)
async def ingest_gdrive_folder(request: GDriveFolderRequest):
    """List and fetch all files from a shared Google Drive folder."""
    try:
        folder_id = extract_gdrive_folder_id(request.folder_url)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        files = await list_folder_files(folder_id)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to list Google Drive folder: {exc}",
        )

    results: list[GDriveFileResult] = []
    for file_info in files:
        file_id = file_info["id"]
        filename = file_info["name"]
        mime_type = file_info.get("mimeType", "")

        try:
            text = await fetch_gdrive_file(file_id, mime_type)
        except Exception:
            # Skip files that cannot be downloaded/exported.
            continue

        size_bytes = int(file_info.get("size", 0)) or len(
            text.encode("utf-8", errors="replace")
        )
        results.append(
            GDriveFileResult(
                filename=filename,
                text=text,
                size_bytes=size_bytes,
            )
        )

    return GDriveFolderResponse(
        files=results,
        total_files=len(results),
    )


@router.post("/parse-file")
async def parse_file(file: UploadFile = File(...)):
    import io
    content = await file.read()
    fname = file.filename.lower() if file.filename else ""

    if fname.endswith(".pdf"):
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            text += (page.extract_text() or "") + "\n\n"
        return {"text": text, "filename": file.filename, "pages": len(reader.pages)}

    elif fname.endswith(".docx"):
        import docx
        doc = docx.Document(io.BytesIO(content))
        text = "\n\n".join([p.text for p in doc.paragraphs])
        return {"text": text, "filename": file.filename, "pages": 1}

    elif fname.endswith(".txt"):
        return {"text": content.decode("utf-8"), "filename": file.filename, "pages": 1}

    else:
        return {"text": content.decode("utf-8", errors="replace"), "filename": file.filename, "pages": 1}
