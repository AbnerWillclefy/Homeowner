# StepIndicator

Where the person is in a multi-step flow: "Passo 2 de 5" and a track of segments. **Core** layer.

The canvas names this component `Stepper` and the Homeowner artboards draw it with `br-stepper*` classes. Bedrock already has a `Stepper`, the +/- control (see `Counter`), so this copy files it as `StepIndicator` with `br-step-indicator*` classes in `bundle.css`. The code name is `StepIndicator`.

- **When to use**: onboarding and any flow of 3 to 7 steps. **When not**: progress of data (use `ProgressBar`).
- At the top of the screen, below Back. Done segments and the current one in `brand`, the next ones in `surface-sunken`.
- The step's name at the end, in `text-muted`.
- Accessibility: visible text, "Passo 2 de 5" at the start and the step's name at the end; the segments are decorative.

The consumer provides the current step, the total and the step's name.
