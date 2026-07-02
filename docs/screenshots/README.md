# README screenshots

Drop the images referenced by the root `README.md` here. Recommended shots:

| File | What to capture |
|------|-----------------|
| `dashboard.png` | Main dashboard — used as the hero image at the top of the README |
| `quotation-pdf.png` | First page of a **generated quotation PDF**, exported as a PNG (the luxury output) |
| `finance.png` | Finance / Accounts dashboard (revenue, receivables, payables, cash) |

## Tips
- Use PNG, ~1600px wide, light mode, with dummy/sample data (no real customer info).
- **To turn a PDF page into a PNG** (so it renders inline on GitHub):
  ```bash
  # ImageMagick
  convert -density 150 quotation.pdf[0] -quality 90 quotation-pdf.png
  # or pdftoppm (poppler)
  pdftoppm -png -r 150 -f 1 -l 1 quotation.pdf quotation-pdf
  ```
