# Draft — "Use of Super Intelligence (SI)" field, and AI record for the README

Living record, last updated 2026-11-15. (This field is not shown to judges; the README version is public.)

## Short text for the form

The problem, the idea and the direction are ours. Our two-person team chose the challenge, decided the question (when and where a south-pole lander keeps sunlight and Earth contact, and what fixes it when it doesn't), set the criteria, and made the design and scope decisions. We used Anthropic's Claude as a coding and writing assistant: it wrote most of the Python computation code and the web front-end under our direction, ran the calculations on NASA data, drafted visual design options, and drafted documentation. We reviewed the code, checked results against NASA's own illumination maps (PGDA product 69), and chose what to keep. No AI-generated images or video are used in the product; any AI-made image in our presentation carries a visible "AI-generated" watermark.

## Detailed record

| Area | What the team did | What AI (Claude, Anthropic) did |
|---|---|---|
| Problem and idea | Chose the challenge and the problem; defined the "wait / raise mast / move" prescription framing and success criteria | Searched for existing work and listed precedents on request; did not choose the idea |
| Data | Chose which NASA datasets to trust and use | Located and downloaded PGDA / JPL files, read file conventions |
| Computation code (`lunar/*.py`) | Specified the method, thresholds, sites rule, mast limits; reviewed outputs | Wrote the code (ephemeris, horizon, terrain stack, prescriptions, calendar, validation) and ran it |
| Validation | Asked for and judged the comparison with PGDA maps | Ran the comparison and reported errors |
| Web tool (`navigator/`, `lunar/map3d/`, `web/`) | Layout direction, design principles, feature choices, testing | Wrote HTML/CSS/JS, proposed visual designs, made screenshots |
| Documents and slides | Final wording and approval | Drafted READMEs, this record, source list, submission text, the 7-slide demo deck and the NYC judging one-pager (from screenshots of our own site) |
| Verdict API (`functions/`, `api/`) and layout fixes | Asked for the API for the Cloudflare award; reviews and merges the pull requests | Wrote the Pages Functions, the tests (`api/test.mjs`) and the header CSS fix, and checked them against the page |
| Images | — | Team photo was AI-generated/edited (`team-moon-photo-maximal.png`) — visible watermark required if shown |

## Metadata / code acknowledgement
- Add to the top of the public README: "Large parts of this code were written with the help of Anthropic's Claude (AI coding assistant), directed and reviewed by team Moon-jigi."
- Add a one-line comment header to AI-written source files (or one note in README covering all of `lunar/`, `navigator/`, `lunar/map3d/`, `web/`).
- AI-made images: visible watermark + note in image metadata.

## Open items
- [ ] Team to confirm the wording of "what the team did" (only you know the exact split)
- [ ] Watermark the team photo if it is used anywhere public
- [ ] Add demo/video tools if any AI tool is used to make them
