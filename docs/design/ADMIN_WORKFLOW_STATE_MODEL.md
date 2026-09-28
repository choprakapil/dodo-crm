[RULE]

# Admin Workflow & State Model

Every stateful admin domain should define states, allowed/forbidden transitions, actors/permissions, preconditions, side effects, confirmation requirements, loading/success/failure behavior, and recovery.

Generic UI states to consider: DEFAULT, LOADING, EMPTY, FILTERED_EMPTY, SELECTED, EDITING, SAVING, SUCCESS, ERROR, RETRY, DISABLED. Domain-specific states come from the real product model.
