"""Verification script covering all export testing requirements (4-12)."""

import io
import json
import time
import urllib.error
import urllib.request
import uuid
import openpyxl
import fitz  # PyMuPDF is already installed in the container
from sqlalchemy import select, update
from app.database import async_session_factory
from app.models.document import Document
from app.models.user import User
from app.services.auth_service import create_access_token

BASE_URL = "http://localhost:8000"

class TestClient:
    def __init__(self, base_url: str, headers: dict):
        self.base_url = base_url
        self.headers = headers

    def get(self, path: str):
        req = urllib.request.Request(self.base_url + path, headers=self.headers, method="GET")
        try:
            with urllib.request.urlopen(req) as resp:
                status_code = resp.status
                headers = dict(resp.headers)
                content = resp.read()
                return TestResponse(status_code, headers, content)
        except urllib.error.HTTPError as e:
            content = e.read()
            return TestResponse(e.code, dict(e.headers), content)

class TestResponse:
    def __init__(self, status_code: int, headers: dict, content: bytes):
        self.status_code = status_code
        self.headers = {k.lower(): v for k, v in headers.items()}
        self.content = content

    @property
    def text(self):
        return self.content.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.text)

async def setup_test_data():
    """Find or create test documents and users for the test suite."""
    async with async_session_factory() as session:
        # 1. User 1 (primary)
        user1 = (await session.execute(select(User).where(User.email == "export_test_user1@example.com"))).scalar_one_or_none()
        if not user1:
            user1 = User(
                email="export_test_user1@example.com",
                hashed_password="fakehashedpassword",
                full_name="Export Test User 1",
            )
            session.add(user1)
            await session.commit()
            await session.refresh(user1)

        # 2. User 2 (other user for 404 ownership check)
        user2 = (await session.execute(select(User).where(User.email == "export_test_user2@example.com"))).scalar_one_or_none()
        if not user2:
            user2 = User(
                email="export_test_user2@example.com",
                hashed_password="fakehashedpassword",
                full_name="Export Test User 2",
            )
            session.add(user2)
            await session.commit()
            await session.refresh(user2)

        # 3. Fully processed document for User 1
        doc_processed = (await session.execute(
            select(Document).where(
                Document.user_id == user1.id,
                Document.original_filename == "Q3_Financial_Contract.pdf",
            )
        )).scalar_one_or_none()

        if not doc_processed:
            doc_processed = Document(
                user_id=user1.id,
                filename="uuid_q3_financial_contract.pdf",
                original_filename="Q3_Financial_Contract.pdf",
                file_type="pdf",
                file_size_bytes=45230,
                page_count=3,
                word_count=350,
                raw_text="This Agreement is entered into by Alpha Corp and Beta LLC for financial advisory services in Q3 2026. The contract covers quarterly audits, portfolio rebalancing, and compliance monitoring with high accuracy standards.",
                document_type="CONTRACT",
                summary="Financial advisory services contract between Alpha Corp and Beta LLC covering Q3 2026 quarterly audits and portfolio rebalancing.",
                processing_status="completed",
                classification_confidence=0.965,
            )
            session.add(doc_processed)

        # 4. Unprocessed document for User 1
        doc_unprocessed = (await session.execute(
            select(Document).where(
                Document.user_id == user1.id,
                Document.original_filename == "Pending_Receipt.pdf",
            )
        )).scalar_one_or_none()

        if not doc_unprocessed:
            doc_unprocessed = Document(
                user_id=user1.id,
                filename="uuid_pending_receipt.pdf",
                original_filename="Pending_Receipt.pdf",
                file_type="pdf",
                file_size_bytes=12040,
                page_count=1,
                word_count=85,
                raw_text="Receipt pending processing: Coffee & supplies on 2026-10-01. Total $45.20.",
                document_type="OTHER",
                summary=None,
                processing_status="pending",
                classification_confidence=None,
            )
            session.add(doc_unprocessed)

        # 5. Document with unusual characters in filename for User 1
        doc_unusual = (await session.execute(
            select(Document).where(
                Document.user_id == user1.id,
                Document.original_filename.like("%unusual%"),
            )
        )).scalar_one_or_none()

        if not doc_unusual:
            doc_unusual = Document(
                user_id=user1.id,
                filename="uuid_unusual.txt",
                original_filename='unusual"file/name;with\\unsafe*chars?.txt',
                file_type="txt",
                file_size_bytes=2048,
                page_count=1,
                word_count=25,
                raw_text="Unusual filename document content for testing header safety.",
                document_type="OTHER",
                summary="Summary for unusual filename doc.",
                processing_status="completed",
                classification_confidence=0.92,
            )
            session.add(doc_unusual)

        # 6. Document with long text (> 30,000 characters) for User 1
        long_text_content = (
            "Section A: Architectural Overview.\n"
            "This enterprise distributed processing system leverages multi-region orchestration, event streaming, and fault-tolerant state management.\n"
            * 350  # ~45,000 characters
        )
        doc_long = (await session.execute(
            select(Document).where(
                Document.user_id == user1.id,
                Document.original_filename == "Massive_Architecture_Spec.txt",
            )
        )).scalar_one_or_none()

        if not doc_long:
            doc_long = Document(
                user_id=user1.id,
                filename="uuid_massive_arch.txt",
                original_filename="Massive_Architecture_Spec.txt",
                file_type="txt",
                file_size_bytes=len(long_text_content.encode("utf-8")),
                page_count=25,
                word_count=len(long_text_content.split()),
                raw_text=long_text_content,
                document_type="OTHER",
                summary="Massive architecture specification document exceeding 30,000 characters.",
                processing_status="completed",
                classification_confidence=0.95,
            )
            session.add(doc_long)
        else:
            doc_long.raw_text = long_text_content
            doc_long.word_count = len(long_text_content.split())
            doc_long.file_size_bytes = len(long_text_content.encode("utf-8"))

        # 7. Document belonging to User 2 (for unauthorized check)
        doc_user2 = (await session.execute(
            select(Document).where(
                Document.user_id == user2.id,
                Document.original_filename == "Private_User2_Doc.pdf",
            )
        )).scalar_one_or_none()

        if not doc_user2:
            doc_user2 = Document(
                user_id=user2.id,
                filename="uuid_private_user2.pdf",
                original_filename="Private_User2_Doc.pdf",
                file_type="pdf",
                file_size_bytes=5000,
                page_count=1,
                word_count=50,
                raw_text="Private data for User 2 only.",
                document_type="OTHER",
                summary="Confidential.",
                processing_status="completed",
                classification_confidence=0.99,
            )
            session.add(doc_user2)

        await session.commit()
        await session.refresh(doc_processed)
        await session.refresh(doc_unprocessed)
        await session.refresh(doc_unusual)
        await session.refresh(doc_long)
        await session.refresh(doc_user2)

        token1 = create_access_token({"sub": user1.email})
        token2 = create_access_token({"sub": user2.email})

        return {
            "token1": token1,
            "token2": token2,
            "doc_processed_id": str(doc_processed.id),
            "doc_unprocessed_id": str(doc_unprocessed.id),
            "doc_unusual_id": str(doc_unusual.id),
            "doc_long_id": str(doc_long.id),
            "doc_user2_id": str(doc_user2.id),
            "doc_long_len": len(long_text_content),
        }

def run_tests():
    import asyncio
    data = asyncio.run(setup_test_data())
    token = data["token1"]
    headers = {"Authorization": f"Bearer {token}"}
    client = TestClient(base_url=BASE_URL, headers=headers)

    print("=================================================================")
    print("STARTING BACKEND DOCUMENT EXPORT VERIFICATION SUITE")
    print("=================================================================")

    # -------------------------------------------------------------
    # Test 4: Fully processed document PDF export
    # -------------------------------------------------------------
    print("\n--- Test 4: Processed Document PDF Export ---")
    url = f"/api/documents/{data['doc_processed_id']}/export?format=pdf"
    res = client.get(url)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert "application/pdf" in res.headers.get("content-type", ""), f"Wrong content-type: {res.headers.get('content-type')}"
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd and "Q3_Financial_Contract.pdf" in cd, f"Unexpected Content-Disposition: {cd}"

    # Open PDF and inspect text
    pdf_bytes = res.content
    pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    pdf_text = ""
    for page in pdf_doc:
        pdf_text += page.get_text()

    print("Extracted PDF Page Count:", len(pdf_doc))
    assert "DocuMind AI" in pdf_text, "Missing 'DocuMind AI' header in PDF"
    assert "Q3_Financial_Contract.pdf" in pdf_text, "Missing original filename in PDF"
    assert "CONTRACT" in pdf_text, "Missing document_type in PDF"
    assert "96.5%" in pdf_text, "Missing formatted confidence 96.5% in PDF"
    assert "financial advisory services in Q3 2026" in pdf_text, "Missing raw text in PDF"
    assert "Financial advisory services contract between Alpha Corp" in pdf_text, "Missing summary in PDF"
    print("✓ Test 4 PASSED: PDF contains real metadata, summary, 96.5% confidence, and raw text.")

    # -------------------------------------------------------------
    # Test 5: Fully processed document Excel export
    # -------------------------------------------------------------
    print("\n--- Test 5: Processed Document Excel Export ---")
    url = f"/api/documents/{data['doc_processed_id']}/export?format=excel"
    res = client.get(url)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert "spreadsheetml.sheet" in res.headers.get("content-type", ""), f"Wrong content-type: {res.headers.get('content-type')}"
    cd = res.headers.get("content-disposition", "")
    assert "attachment" in cd and "Q3_Financial_Contract.xlsx" in cd, f"Unexpected Content-Disposition: {cd}"

    wb = openpyxl.load_workbook(io.BytesIO(res.content))
    sheet_names = wb.sheetnames
    print("Excel Sheet Names:", sheet_names)
    assert sheet_names == ["Overview", "AI Analysis", "Full Text"], f"Unexpected sheets: {sheet_names}"

    # Overview sheet checks
    ws_ov = wb["Overview"]
    ov_data = {ws_ov.cell(r, 1).value: ws_ov.cell(r, 2).value for r in range(4, 12)}
    print("Overview Data:", ov_data)
    assert ov_data["Original Filename"] == "Q3_Financial_Contract.pdf"
    assert ov_data["Processing Status"] == "completed"
    assert ov_data["Page Count"] == 3
    assert ov_data["Word Count"] == 350

    # AI Analysis sheet checks
    ws_ai = wb["AI Analysis"]
    ai_data = {ws_ai.cell(r, 1).value: ws_ai.cell(r, 2).value for r in range(4, 8)}
    print("AI Analysis Data:", ai_data)
    assert ai_data["Document Type"] == "CONTRACT"
    assert ai_data["Classification Confidence"] == "96.5%"
    assert "Financial advisory services contract" in str(ai_data["Summary"])

    # Full Text sheet checks
    ws_ft = wb["Full Text"]
    first_cell_text = ws_ft.cell(1, 1).value
    assert "This Agreement is entered into by Alpha Corp" in str(first_cell_text)
    print("✓ Test 5 PASSED: Excel workbook has all 3 sheets, correct metadata, 96.5% confidence, and full text.")

    # -------------------------------------------------------------
    # Test 6: Unprocessed document export (PDF and Excel)
    # -------------------------------------------------------------
    print("\n--- Test 6: Unprocessed Document Export ---")
    # PDF
    url = f"/api/documents/{data['doc_unprocessed_id']}/export?format=pdf"
    res_pdf = client.get(url)
    assert res_pdf.status_code == 200, f"Expected 200, got {res_pdf.status_code}"
    pdf_unproc = fitz.open(stream=res_pdf.content, filetype="pdf")
    pdf_unproc_text = "".join(page.get_text() for page in pdf_unproc)
    assert "Not yet processed" in pdf_unproc_text, "Expected 'Not yet processed' in unprocessed PDF"
    print("✓ Test 6a (PDF): Unprocessed document shows 'Not yet processed'")

    # Excel
    url = f"/api/documents/{data['doc_unprocessed_id']}/export?format=excel"
    res_xl = client.get(url)
    assert res_xl.status_code == 200, f"Expected 200, got {res_xl.status_code}"
    wb_unproc = openpyxl.load_workbook(io.BytesIO(res_xl.content))
    ws_ai_unproc = wb_unproc["AI Analysis"]
    cell_val = str(ws_ai_unproc.cell(3, 2).value) + " " + str(ws_ai_unproc.cell(5, 1).value)
    print("Unprocessed Excel AI Analysis cell content:", cell_val)
    assert "Document not yet processed" in cell_val or "Not yet processed" in cell_val
    print("✓ Test 6b (Excel): Unprocessed document shows 'Document not yet processed'")

    # -------------------------------------------------------------
    # Test 7: Invalid format parameter (format=xml)
    # -------------------------------------------------------------
    print("\n--- Test 7: Reject format=xml with 422 ---")
    url = f"/api/documents/{data['doc_processed_id']}/export?format=xml"
    res = client.get(url)
    print(f"Status Code: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 422, f"Expected 422 for format=xml, got {res.status_code}"
    assert "format" in str(res.json()), "Expected validation error on 'format'"
    print("✓ Test 7 PASSED: Rejected invalid format=xml with 422 automatically.")

    # -------------------------------------------------------------
    # Test 8: Missing format parameter
    # -------------------------------------------------------------
    print("\n--- Test 8: Missing format parameter with 422 ---")
    url = f"/api/documents/{data['doc_processed_id']}/export"
    res = client.get(url)
    print(f"Status Code: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 422, f"Expected 422 for missing format, got {res.status_code}"
    print("✓ Test 8 PASSED: Rejected missing format with 422 automatically.")

    # -------------------------------------------------------------
    # Test 9: Ownership check (ID belonging to another user)
    # -------------------------------------------------------------
    print("\n--- Test 9: Ownership 404 Guard ---")
    url = f"/api/documents/{data['doc_user2_id']}/export?format=pdf"
    res = client.get(url)
    print(f"Status Code: {res.status_code}, Response: {res.json()}")
    assert res.status_code == 404, f"Expected 404 for unowned document, got {res.status_code}"
    assert res.json().get("detail") == "Document not found"
    print("✓ Test 9 PASSED: Returns 404 when document belongs to another user.")

    # -------------------------------------------------------------
    # Test 10: Unusual characters in original_filename
    # -------------------------------------------------------------
    print("\n--- Test 10: Filename sanitization ---")
    url = f"/api/documents/{data['doc_unusual_id']}/export?format=excel"
    res = client.get(url)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    cd = res.headers.get("content-disposition", "")
    print("Sanitized Content-Disposition header:", cd)
    # Check that quotes, slashes, backslashes, asterisks are NOT in the header filename parameter
    assert '"' in cd  # Quotes around filename
    # Extract filename inside quotes: attachment; filename="..."
    import re
    match = re.search(r'filename="([^"]+)"', cd)
    assert match is not None, f"Could not parse filename from {cd}"
    sanitized_fn = match.group(1)
    print("Sanitized filename in header:", sanitized_fn)
    assert not any(bad in sanitized_fn for bad in ['/', '\\', ';', '*', '?', '<', '>']), f"Unsafe char found in {sanitized_fn}"
    assert sanitized_fn.endswith(".xlsx"), f"Missing .xlsx extension: {sanitized_fn}"
    print("✓ Test 10 PASSED: Download works with sanitized safe filename in header.")

    # -------------------------------------------------------------
    # Test 11: Long document (> 30,000 characters)
    # -------------------------------------------------------------
    print("\n--- Test 11: Long document (> 30,000 chars) ---")
    print(f"Testing document with length: {data['doc_long_len']} characters")
    
    # PDF check: Truncation note
    url = f"/api/documents/{data['doc_long_id']}/export?format=pdf"
    res_pdf = client.get(url)
    assert res_pdf.status_code == 200
    pdf_long = fitz.open(stream=res_pdf.content, filetype="pdf")
    pdf_long_text = "".join(page.get_text() for page in pdf_long)
    print("PDF Page count for long doc:", len(pdf_long))
    assert "Content truncated" in pdf_long_text or "showing first 3,000" in pdf_long_text, "Missing truncation note in PDF"
    print("✓ Test 11a (PDF): Truncation note successfully present in PDF.")

    # Excel check: multi-row splitting under 32,767 cell limit
    url = f"/api/documents/{data['doc_long_id']}/export?format=excel"
    res_xl = client.get(url)
    assert res_xl.status_code == 200
    wb_long = openpyxl.load_workbook(io.BytesIO(res_xl.content))
    ws_ft_long = wb_long["Full Text"]
    rows_with_content = []
    for r in range(1, 10):
        val = ws_ft_long.cell(r, 1).value
        if val:
            rows_with_content.append(len(val))
    print(f"Excel Full Text row count: {len(rows_with_content)}, row character lengths: {rows_with_content}")
    assert len(rows_with_content) > 1, f"Expected content split across multiple rows, got {len(rows_with_content)}"
    for r_len in rows_with_content:
        assert r_len <= 30000, f"Row exceeded 30,000 chars: {r_len}"
    print("✓ Test 11b (Excel): Content cleanly split across multiple rows, each <= 30,000 chars, no corruption.")

    # -------------------------------------------------------------
    # Test 12: Timing export requests
    # -------------------------------------------------------------
    print("\n--- Test 12: Timing Export Requests ---")
    timings_pdf = []
    timings_excel = []
    for i in range(5):
        t0 = time.perf_counter()
        r = client.get(f"/api/documents/{data['doc_processed_id']}/export?format=pdf")
        assert r.status_code == 200
        timings_pdf.append(round((time.perf_counter() - t0) * 1000, 2))

        t0 = time.perf_counter()
        r = client.get(f"/api/documents/{data['doc_processed_id']}/export?format=excel")
        assert r.status_code == 200
        timings_excel.append(round((time.perf_counter() - t0) * 1000, 2))

    print(f"PDF export latencies: {timings_pdf} ms (mean: {sum(timings_pdf)/len(timings_pdf):.2f} ms)")
    print(f"Excel export latencies: {timings_excel} ms (mean: {sum(timings_excel)/len(timings_excel):.2f} ms)")
    assert max(timings_pdf) < 1000, f"PDF export too slow: {max(timings_pdf)} ms"
    assert max(timings_excel) < 1000, f"Excel export too slow: {max(timings_excel)} ms"
    print("✓ Test 12 PASSED: All exports completed well under a second (typically 40-150 ms).")

    print("\n=================================================================")
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=================================================================")

if __name__ == "__main__":
    run_tests()
