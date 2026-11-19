# Exercise demo photo credits

Demo images on `/gym/exercises/[key]` come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), released under
the [Unlicense](https://unlicense.org/) (public domain).

The mapping from this app's stable exercise keys (`seed:*`) to the dataset's
image folders lives in `src/data/exercise-media.ts`. Only exercises with a
confident name match are mapped; every exercise still has YouTube / Instagram
/ web search links, so a missing image never blocks the demo.

Equipment photos on `/gym/setup` are hotlinked from Wikimedia Commons and
Wikipedia under their respective Creative Commons licences. See
`src/data/gym-equipment.ts` for the source image URLs.
