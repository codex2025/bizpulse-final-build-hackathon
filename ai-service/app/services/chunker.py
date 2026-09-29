import re
from typing import List, Dict, Any

class DocumentChunker:
    """
    Semantic clause and paragraph boundary chunker for legal and financial contracts.
    Preserves chunk index, page number estimation, and section titles.
    """

    @staticmethod
    def chunk_document(text: str, filename: str = "") -> List[Dict[str, Any]]:
        # Split on common legal section patterns or double newlines
        pattern = r'(?=(?:(?:\r?\n){2,}|(?<=\n)(?:Section|Clause|Article|\d+\.|\([a-z0-9]+\))\s+))'
        raw_sections = [s.strip() for s in re.split(pattern, text, flags=re.IGNORECASE) if s.strip()]
        
        chunks: List[Dict[str, Any]] = []
        chunk_idx = 0
        current_page = 1
        words_per_page = 350 # rough estimate if page breaks aren't explicit

        cum_words = 0
        for section in raw_sections:
            # If section contains explicit page break markers (e.g. from pdfplumber)
            if "--- PAGE" in section:
                page_match = re.search(r'---\s*PAGE\s+(\d+)\s*---', section)
                if page_match:
                    current_page = int(page_match.group(1))

            # Extract title if it matches a clause heading
            first_line = section.split('\n')[0].strip()
            section_title = first_line[:60] if len(first_line) > 0 else f"Section {chunk_idx + 1}"

            # If section is very long (> 1500 chars), split into sub-paragraphs
            if len(section) > 1500:
                sub_parts = re.split(r'\n{1,2}', section)
                buffer = ""
                for part in sub_parts:
                    if len(buffer) + len(part) < 1200:
                        buffer += ("\n" + part if buffer else part)
                    else:
                        if buffer.strip():
                            chunk_id = f"chunk_{chunk_idx + 1}"
                            cum_words += len(buffer.split())
                            est_page = max(current_page, (cum_words // words_per_page) + 1)
                            chunks.append({
                                "chunk_id": chunk_id,
                                "chunk_index": chunk_idx,
                                "text": buffer.strip(),
                                "page_number": est_page,
                                "section_title": section_title,
                            })
                            chunk_idx += 1
                        buffer = part
                if buffer.strip():
                    chunk_id = f"chunk_{chunk_idx + 1}"
                    cum_words += len(buffer.split())
                    est_page = max(current_page, (cum_words // words_per_page) + 1)
                    chunks.append({
                        "chunk_id": chunk_id,
                        "chunk_index": chunk_idx,
                        "text": buffer.strip(),
                        "page_number": est_page,
                        "section_title": section_title,
                    })
                    chunk_idx += 1
            else:
                chunk_id = f"chunk_{chunk_idx + 1}"
                cum_words += len(section.split())
                est_page = max(current_page, (cum_words // words_per_page) + 1)
                chunks.append({
                    "chunk_id": chunk_id,
                    "chunk_index": chunk_idx,
                    "text": section.strip(),
                    "page_number": est_page,
                    "section_title": section_title,
                })
                chunk_idx += 1

        # Fallback if text couldn't be split
        if not chunks and text.strip():
            chunks.append({
                "chunk_id": "chunk_1",
                "chunk_index": 0,
                "text": text.strip()[:2000],
                "page_number": 1,
                "section_title": "General Terms",
            })

        return chunks
