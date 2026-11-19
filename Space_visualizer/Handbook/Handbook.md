---
title: Handbook
tags: [handbook, index]
date: 2026-11-19
---

# Project handbook

Back to [[Home]] · New here? Read [[Start here]] first for the working agreements and the current state.

This handbook documents how the Solar System Visualizer is made: the method, the structure, the standards, every rule, every source and the reason behind every decision. It gathers in one place what is spread across the specs, plans, decision notes and source notes, and links to each of them for the full record.

| Note | What it answers |
|---|---|
| [[Methodology]] | How work is done: design talk, spec, plan, subagent build, reviews; how values are found and proven (the quote method); how visuals are judged; how results are verified and recorded |
| [[Structure]] | How the project is laid out: the pipeline and the app, the data flow, every folder and module, the data model, the frame order, the vault |
| [[Code quality and requirements]] | What the app must do and how well (goals, functional and non-functional requirements), the code standards, the tests, the review gates, the known debts |
| [[Rules]] | Every rule, with where it is stated and why: sources, values and citation, positions and time, imagery, code, testing, process, writing |
| [[Sources register]] | Every one of the sources the app cites, grouped by family, with why each family is trusted and what each source supplies; plus the sources considered and not used, and why (generated) |
| [[Decision register]] | Every decision, who made it and why: product direction, technology, data and sources, interface, scope rulings, rulings made while building, and the open decisions |

## The project in five lines
- A 3D, time-accurate solar system in the browser, designed to grow to stars and galaxies.
- **Accuracy, information and visuals carry equal weight.**
- Every value comes from an official source and is cited on screen; every hand-curated value keeps the exact sentence it came from, checked by the build.
- Visuals aim at a cinematic bar; anything that is not data is labelled illustrative.
- Built in sections, each designed with the user, planned, built test-first by fresh implementers, reviewed per task and as a whole, and documented in this vault as it goes.

## Keeping the handbook current
- **Rules, structure, methodology and requirements:** update the note when a rule or process changes, in the same piece of work. If a source note and this handbook disagree, the source note wins and the handbook is corrected.
- **Sources register:** regenerate it after `npm run data` with `node scripts/sources-register.mjs`. It reads the committed data, so it always matches what the app cites. Edit the family descriptions and the "considered and not used" table in the script.
- **Decision register:** add a line when a decision note is written, a spec is approved, or a plan's Execution record gains rulings. Keep the full text where it was written; the register gives the reason in a line and links to it.
