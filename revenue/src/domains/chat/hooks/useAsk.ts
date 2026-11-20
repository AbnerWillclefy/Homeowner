import { useMutation } from "@tanstack/react-query";
import { ask, type AskBody } from "../api";

/** A mutation, not a query: the conversation is never cached, and `gcTime: 0` drops the mutation as soon as it settles. */
// The wrapper keeps the mutation's own second argument out of `ask`'s `client` parameter.
export const useAsk = () => useMutation({ mutationFn: (body: AskBody) => ask(body), gcTime: 0 });
