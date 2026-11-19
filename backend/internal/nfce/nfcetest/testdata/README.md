# NFC-e fixtures

Captured SEFAZ consultation responses, anonymised (#777). Each file is the `xml` field of the JSON that the state answers: an HTML fragment with entities (`&nbsp;`, `&oacute;`), not a full page.

Every fixture plants the same fake consumer, `111.444.777-35` and `CONSUMIDOR TESTE`. Tests assert that neither reaches the database or a response. The access key and the receipt number are made up: the key keeps the state, month, CNPJ, model `65` and series, and has a valid check digit.

## 23-1.html (Ceará)

Fetched with `POST http://nfce.sefaz.ce.gov.br/nfce/api/notasFiscal/qrcodev2/` on 2026-11-19.

| Field | Expected |
|---|---|
| Access key | `23261175315333015807655140000123451111111115` (printed in groups of four) |
| Store name | `ATACADAO S.A.` |
| Store CNPJ | `75315333015807` (printed `75.315.333/0158-07`) |
| Issued on | 2026-11-18 (printed `18/11/2026 18:59:43`) |
| Total | 52384 cents (`Valor a pagar`; `Valor total` 525,64 before the 1,80 discount) |
| Lines | 34 |
| First line | `MARG.PRIMOR C/S`, code `2151`, quantity 1, unit `PTE8`, unit price 599, total 599 |
| A weighed line | `BOV.PATINHO MOIDO RE`, code `85424`, quantity 1,496, unit `KG9`, unit price 5990, total 8961 |

Notes for the parser:
- Lines are the `<tr id='Item + n'>` rows of `table#tabResult`. The fields are the spans `txtTit`, `RCod`, `Rqtd`, `RUN`, `RvlUnit` and `valor`.
- The unit is printed with a trailing digit (`UND9`, `KG9`, `PTE8`, `MCO1`). The fixture keeps it as served.
- The discount is a single receipt-level `Descontos R$` line. The lines carry no discount of their own, so they sum to `Valor total`, not to `Valor a pagar`.
- Lines carry only the store's own product code. There is no GTIN.
