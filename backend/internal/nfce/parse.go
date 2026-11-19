package nfce

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"golang.org/x/net/html"
)

var errUnreadable = errors.New("nfce: unreadable page")

// parseCE reads the HTML fragment Ceará's consultation answers. It never
// touches the "Consumidor" block, where the CPF is printed. Any missing or
// malformed field is an error, never a partial receipt.
func parseCE(fragment string) (Receipt, error) {
	doc, err := html.Parse(strings.NewReader(fragment))
	if err != nil {
		return Receipt{}, errUnreadable
	}
	var r Receipt
	if n := find(doc, func(n *html.Node) bool { return hasClass(n, "txtTopo") }); n != nil {
		r.StoreName = text(n)
	}
	if n := find(doc, func(n *html.Node) bool { return hasClass(n, "text") && strings.HasPrefix(text(n), "CNPJ:") }); n != nil {
		r.CNPJ = digits(text(n))
	}
	if r.StoreName == "" || len(r.CNPJ) != 14 {
		return Receipt{}, errUnreadable
	}

	// "Emissão:" is a <strong> followed by the date text.
	if n := find(doc, func(n *html.Node) bool { return n.Data == "strong" && text(n) == "Emissão:" }); n != nil && n.NextSibling != nil {
		if f := strings.Fields(n.NextSibling.Data); len(f) > 0 && len(f[0]) >= 10 {
			r.IssuedOn, err = time.Parse("02/01/2006", f[0][:10])
		}
	}
	if err != nil || r.IssuedOn.IsZero() {
		return Receipt{}, errUnreadable
	}

	// The total is "Valor a pagar" (after the discount), else "Valor total".
	total := labelled(doc, "Valor a pagar R$:")
	if total == "" {
		total = labelled(doc, "Valor total R$:")
	}
	if r.TotalCents, err = parseDecimal(total, 2); err != nil {
		return Receipt{}, errUnreadable
	}

	tab := find(doc, func(n *html.Node) bool { return n.Data == "table" && attr(n, "id") == "tabResult" })
	if tab == nil {
		return Receipt{}, errUnreadable
	}
	for _, row := range findAll(tab, func(n *html.Node) bool { return n.Data == "tr" && strings.HasPrefix(attr(n, "id"), "Item") }) {
		l, err := parseLine(row)
		if err != nil {
			return Receipt{}, fmt.Errorf("%w: line %d", errUnreadable, len(r.Lines)+1)
		}
		r.Lines = append(r.Lines, l)
	}
	if len(r.Lines) == 0 {
		return Receipt{}, errUnreadable
	}
	return r, nil
}

func parseLine(row *html.Node) (Line, error) {
	span := func(class string) string {
		if n := find(row, func(n *html.Node) bool { return n.Data == "span" && hasClass(n, class) }); n != nil {
			return text(n)
		}
		return ""
	}
	var l Line
	var err1, err2, err3 error
	l.Description = span("txtTit")
	l.ProductCode = strings.TrimSuffix(strings.TrimSpace(strings.TrimPrefix(strings.TrimPrefix(span("RCod"), "(Código:"), "(")), ")")
	l.Unit = strings.TrimSpace(strings.TrimPrefix(span("RUN"), "UN:"))
	l.QuantityMilli, err1 = parseDecimal(strings.TrimPrefix(span("Rqtd"), "Qtde.:"), 3)
	l.UnitPriceCents, err2 = parseDecimal(strings.TrimPrefix(span("RvlUnit"), "Vl. Unit.:"), 2)
	l.TotalCents, err3 = parseDecimal(span("valor"), 2)
	if l.Description == "" || l.Unit == "" || l.QuantityMilli <= 0 || err1 != nil || err2 != nil || err3 != nil {
		return Line{}, errUnreadable
	}
	return l, nil
}

// parseDecimal reads a Brazilian number ("1.234,56") as an integer with the
// given decimal places, never through a float. Extra places must be zeros.
func parseDecimal(s string, places int) (int64, error) {
	s = strings.ReplaceAll(strings.TrimSpace(s), ".", "")
	whole, frac, _ := strings.Cut(s, ",")
	frac = strings.TrimRight(frac, "0")
	if len(frac) > places || whole == "" {
		return 0, errUnreadable
	}
	frac += strings.Repeat("0", places-len(frac))
	for _, c := range whole + frac {
		if c < '0' || c > '9' {
			return 0, errUnreadable
		}
	}
	return strconv.ParseInt(whole+frac, 10, 64)
}

// labelled is the text of the element after the <label> reading label.
func labelled(doc *html.Node, label string) string {
	l := find(doc, func(n *html.Node) bool { return n.Data == "label" && text(n) == label })
	for s := l; s != nil; s = s.NextSibling {
		if s != l && s.Type == html.ElementNode {
			return text(s)
		}
	}
	return ""
}

func digits(s string) string {
	return strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, s)
}

func attr(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}

func hasClass(n *html.Node, class string) bool {
	for _, c := range strings.Fields(attr(n, "class")) {
		if c == class {
			return true
		}
	}
	return false
}

// text is the node's text, with the label <strong> children included and
// whitespace (nbsp too) collapsed.
func text(n *html.Node) string {
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			b.WriteString(n.Data)
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return strings.Join(strings.Fields(b.String()), " ")
}

func find(n *html.Node, match func(*html.Node) bool) *html.Node {
	if n.Type == html.ElementNode && match(n) {
		return n
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		if f := find(c, match); f != nil {
			return f
		}
	}
	return nil
}

func findAll(n *html.Node, match func(*html.Node) bool) []*html.Node {
	var out []*html.Node
	if n.Type == html.ElementNode && match(n) {
		out = append(out, n)
	}
	for c := n.FirstChild; c != nil; c = c.NextSibling {
		out = append(out, findAll(c, match)...)
	}
	return out
}
