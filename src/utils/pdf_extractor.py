"""
PDF Extractor with OCR fallback using PyMuPDF (fitz) and EasyOCR.
Extracts digital text directly or uses OCR for scanned pages/documents.
"""

import os
import io
import re
import base64
import requests
from pathlib import Path
from typing import Optional, Dict, Any, List
from loguru import logger
import numpy as np
from PIL import Image

_easyocr_reader = None

def get_easyocr_reader(lang: str = "en"):
    """Lazy initialization of EasyOCR reader"""
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            import torch
            use_gpu = torch.cuda.is_available()
            logger.info(f"Initializing EasyOCR reader (gpu={use_gpu})...")
            _easyocr_reader = easyocr.Reader(['en'], gpu=use_gpu)
            logger.info("EasyOCR reader initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize EasyOCR: {e}")
            _easyocr_reader = None
    return _easyocr_reader

class PDFExtractor:
    """
    Extracts text from PDF documents.
    Tries native digital text extraction first (instant and lossless).
    If a page is scanned, image-only, or has sparse text (<40 chars),
    automatically renders the page to a high-res image and runs OCR.
    """

    def __init__(self, max_pages: int = 5, ocr_min_chars: int = 40):
        self.max_pages = max_pages
        self.ocr_min_chars = ocr_min_chars

    def load_pdf_bytes(self, pdf_input: Any) -> bytes:
        """Load raw PDF bytes from bytes, base64, URL, or local file path"""
        if not pdf_input:
            raise ValueError("Empty PDF input provided")

        if isinstance(pdf_input, (bytes, bytearray)):
            return bytes(pdf_input)

        # 1. Base64 data URI
        if pdf_input.startswith("data:"):
            if "base64," in pdf_input:
                encoded = pdf_input.split("base64,", 1)[1]
            else:
                encoded = pdf_input.split(",", 1)[1]
            return base64.b64decode(encoded)

        # 2. Remote URL
        if pdf_input.startswith("http://") or pdf_input.startswith("https://"):
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            resp = requests.get(pdf_input, headers=headers, timeout=20)
            resp.raise_for_status()
            return resp.content

        # 3. Local file path
        path = Path(pdf_input)
        if path.exists() and path.is_file():
            return path.read_bytes()

        # 4. Check if raw base64 string
        try:
            decoded = base64.b64decode(pdf_input, validate=True)
            if decoded.startswith(b"%PDF"):
                return decoded
        except Exception:
            pass

        raise FileNotFoundError(f"Could not load PDF from: {pdf_input[:100]}...")

    def extract_text(self, pdf_input: str) -> Dict[str, Any]:
        """
        Extract text from PDF using digital extraction + OCR fallback.

        Returns:
            Dict containing:
            - full_text: string
            - pages_processed: int
            - ocr_used: bool
            - extracted_claim: main claim/statement to verify
        """
        import fitz  # PyMuPDF

        pdf_bytes = self.load_pdf_bytes(pdf_input)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        total_pages = len(doc)
        pages_to_process = min(total_pages, self.max_pages)
        page_texts: List[str] = []
        ocr_used = False

        logger.info(f"Processing PDF document ({total_pages} total pages, inspecting first {pages_to_process})...")

        for page_idx in range(pages_to_process):
            page = doc[page_idx]
            native_text = page.get_text("text").strip()

            # Check if page has sufficient digital text
            if len(native_text) >= self.ocr_min_chars:
                logger.debug(f"Page {page_idx + 1}: Extracted {len(native_text)} chars digitally")
                page_texts.append(native_text)
            else:
                # Page is image-heavy or scanned: Run OCR
                logger.info(f"Page {page_idx + 1}: Sparse text ({len(native_text)} chars). Running OCR...")
                ocr_text = self._ocr_page(page)
                if ocr_text:
                    ocr_used = True
                    logger.info(f"Page {page_idx + 1}: OCR extracted {len(ocr_text)} chars")
                    combined = f"{native_text}\n{ocr_text}".strip()
                    page_texts.append(combined)
                elif native_text:
                    page_texts.append(native_text)

        full_text = "\n\n".join(page_texts).strip()
        doc.close()

        # Extract primary claim / statement from document
        extracted_claim = self._derive_primary_claim(full_text)

        return {
            "full_text": full_text,
            "pages_processed": pages_to_process,
            "total_pages": total_pages,
            "ocr_used": ocr_used,
            "extracted_claim": extracted_claim,
        }

    def _ocr_page(self, page) -> str:
        """Render a PDF page to image and perform OCR using EasyOCR"""
        try:
            # Render page at 150 DPI for fast and accurate OCR
            pix = page.get_pixmap(dpi=150)
            img_bytes = pix.tobytes("png")
            image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            img_np = np.array(image)

            reader = get_easyocr_reader()
            if reader is None:
                logger.warning("EasyOCR reader not available, skipping OCR")
                return ""

            ocr_results = reader.readtext(img_np, detail=0)
            return " ".join(ocr_results).strip()
        except Exception as e:
            logger.error(f"Error during page OCR: {e}")
            return ""

    def _derive_primary_claim(self, full_text: str) -> str:
        """Extract or synthesize the primary factual claim from the document text"""
        if not full_text:
            return "The document contains verified informational statements."

        # Clean whitespace
        cleaned = re.sub(r'\s+', ' ', full_text).strip()

        # Split into candidate sentences
        sentences = re.split(r'(?<=[.!?])\s+', cleaned)
        informative_sentences = [
            s.strip() for s in sentences
            if len(s.strip()) > 30 and len(s.strip()) < 300
            and not s.lower().startswith(("table of contents", "page ", "copyright", "all rights"))
        ]

        if informative_sentences:
            # Use the lead informative statement
            return informative_sentences[0]

        return cleaned[:250]
