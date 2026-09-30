import os
import tempfile
from PIL import Image
import fitz  # PyMuPDF
import docx
import pytesseract


def extract_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF.

    If total extracted text is under 100 characters (likely a scanned PDF),
    falls back to rendering each page as an image and running pytesseract OCR.
    Temp images are always cleaned up in a finally block.
    """
    doc = fitz.open(file_path)
    try:
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        full_text = "\n".join(text_parts).strip()

        if len(full_text) >= 100:
            return full_text

        # Scanned PDF fallback: render each page to an image and run OCR
        ocr_text_parts = []
        for page_index in range(len(doc)):
            page = doc[page_index]
            pix = page.get_pixmap()

            temp_img_file = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
            temp_img_path = temp_img_file.name
            temp_img_file.close()

            try:
                pix.save(temp_img_path)
                with Image.open(temp_img_path) as img:
                    page_text = pytesseract.image_to_string(img)
                    ocr_text_parts.append(page_text)
            finally:
                if os.path.exists(temp_img_path):
                    try:
                        os.remove(temp_img_path)
                    except Exception:
                        pass

        ocr_full_text = "\n".join(ocr_text_parts).strip()
        return ocr_full_text if ocr_full_text else full_text
    finally:
        doc.close()


def extract_docx(file_path: str) -> str:
    """Extract text from a Word .docx document by joining all paragraph text."""
    doc = docx.Document(file_path)
    return "\n".join([p.text for p in doc.paragraphs]).strip()


def extract_image(file_path: str) -> str:
    """Extract text directly from an image file (PNG/JPG/JPEG) using pytesseract."""
    with Image.open(file_path) as img:
        return pytesseract.image_to_string(img).strip()


def extract_txt(file_path: str) -> str:
    """Extract text from a plain text file."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    except UnicodeDecodeError:
        with open(file_path, "r", encoding="latin-1", errors="replace") as f:
            return f.read().strip()


def extract_text(file_path: str, file_type: str) -> str:
    """Dispatch to the appropriate extractor based on file extension.

    Raises ValueError for unsupported types.
    """
    ext = file_type.lower().strip()
    if not ext.startswith("."):
        ext = f".{ext}"

    if ext == ".pdf":
        return extract_pdf(file_path)
    elif ext == ".docx":
        return extract_docx(file_path)
    elif ext in {".png", ".jpg", ".jpeg"}:
        return extract_image(file_path)
    elif ext == ".txt":
        return extract_txt(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def get_page_count(file_path: str, file_type: str) -> int | None:
    """Get page count for supported files where applicable."""
    ext = file_type.lower().strip()
    if not ext.startswith("."):
        ext = f".{ext}"

    if ext == ".pdf":
        doc = fitz.open(file_path)
        try:
            return len(doc)
        finally:
            doc.close()
    elif ext in {".png", ".jpg", ".jpeg", ".txt", ".docx"}:
        return 1
    return None
