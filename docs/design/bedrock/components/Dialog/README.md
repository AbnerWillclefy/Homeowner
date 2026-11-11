# Dialog

Confirmation of something destructive or irreversible. Only that.

- The title states the consequence ("Disconnect Nubank?"), the body says what is lost and what stays.
- Buttons: "Cancel" (secondary) and the action in `danger` with the exact verb ("Disconnect"). Initial focus on Cancel.
- For everything else, do it and offer Undo in a Toast.

Implementation: shadcn/ui `AlertDialog`.
