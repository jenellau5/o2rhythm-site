# O₂ Rhythm — Demo Folder

This folder contains the public demo experience used on the main website.

Goal: show how Rhythm O₂ works in **30–45 seconds**, with **low friction**, and track engagement via GA4.

## Files

- `index.html`  
  Demo hub page (choose environment)

- `desk.html`  
  **DESK — RESET 45** (45 sec breathing protocol)  
  Use case: after a stressful call / cognitive load recovery.

- `vehicle.html`  
  **VEHICLE — PRE-ARRIVAL 30** (30 sec breathing protocol)  
  Use case: stabilize before stepping out (patrol, fire, EMS).

- `nonbreath.html`  
  **NO-BREATH — NAME 5** (~45 sec prompt timer)  
  Use case: grounding without breathwork (adoption-friendly).

## Notes

- Desk + Vehicle demos use shared protocol engine:
  - `/assets/protocol.js`
  - `/assets/style.css`

- Non-breath demo is self-contained and does **not** use `protocol.js`
  (because it is prompt-based, not a breathing pacer).

- These demos intentionally use:
  - `data-agency="public"`
  - `data-environment="demo_*"`
  so GA4/data doesn’t get mixed with real agency deployments.

---

## GA4 Tracking (Events)

All demos include GA4 and fire events to measure usage.

### Core events
- `demo_view`
  - Fires on page load
  - Params:
    - `demo` (e.g., `desk_reset45`)
    - `page` (e.g., `demo_desk`)

- `demo_start`
  - Fires when user presses START
  - Params: `demo`, `page`

- `demo_complete`
  - Fires when timer hits 0
  - Params: `demo`, `page`

- `demo_sound_toggle`
  - Fires when user toggles sound
  - Params:
    - `demo`, `page`
    - `state` (`on` or `off`)

### Navigation + CTA events
- `nav_click`
  - Fires on demo nav links (All demos / Next / Back)
  - Params:
    - `page`
    - `cta` (e.g., `next_vehicle`)

- `cta_click`
  - Fires on “Bring this to my agency”
  - Params:
    - `page`
    - `cta` (e.g., `bring_to_agency_from_desk_demo`)

### Non-breath only
- `demo_prompt_change`
  - Fires when the prompt advances (Name 5 → Name 4 → etc.)
  - Params:
    - `demo`, `page`
    - `step` (e.g., `NAME 4`)

---

## Recommended GA4 Conversions

If you want one conversion to represent interest:

- Mark `cta_click` as a conversion (or create a conversion for:
  - `cta_click` where `cta` contains `bring_to_agency`)

Optional:
- Mark `demo_complete` as a conversion if you want to measure “finished a demo.”

---

## Deployment Tips

- Homepage should display **one demo QR** that points to:  
  `/demo/`

- Real agency deployments should use **separate QR codes per environment**
  (desk, vehicle, breakroom, etc.) to eliminate extra taps and increase adoption.