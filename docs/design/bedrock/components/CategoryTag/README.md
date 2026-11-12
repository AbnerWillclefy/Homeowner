# CategoryTag

A spending category: an icon in a square in the category's colour, the name and its share.

- **When to use**: to name a Spending Category in a list, a legend or a filter. **When not**: for a status (use `Badge`), or for a category that is not one of the 13 below.
- **Variants**: icon colour `cat-<category>` on `cat-<category>-soft`. The category has the same colour in every chart, row and filter of the app. The icon square also exists alone, for `ListRow`.
- **Sizes**: 32px in lists, 24px in legends and chips. The share ("41%") sits in a neutral pill to the right of the name.
- **Icons**, fixed per category (lucide): Housing `house`, Groceries `shopping-cart`, Eating out `utensils`, Transport `car`, Household bills `zap`, Subscriptions `repeat`, Health `heart-pulse`, Education `graduation-cap`, Leisure `ticket`, Shopping `shopping-bag`, Pets `paw-print`, Taxes and fees `landmark`, Other `circle-ellipsis`.
- **States**: not interactive.
- **Content**: the category's name in the person's language, as the app passes it.
- **Accessibility**: the icon is `aria-hidden`; the name is text, so colour is never the only cue.

The consumer provides the category id, the localised name and optionally the share. Implementation: a plain element on the tokens, with lucide icons.
