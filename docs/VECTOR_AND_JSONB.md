# Vector Embeddings and Binary JSON (JSONB) in SQLite 3.45+

Modern SQLite introduces dedicated formats for binary structured data and high-dimensional vector embeddings. LiteLens provides native viewers and calculation tools for both formats.

## SQLite 3.45 JSONB Format

Starting with version 3.45.0, SQLite includes native support for `jsonb`. Rather than storing JSON as plain UTF-8 text strings, `jsonb` stores the document in a pre-parsed binary tree. This reduces storage footprint and eliminates parsing overhead when executing `json_extract()` or `jsonb_extract()`.

A JSONB payload consists of typed elements:
* Elements begin with a header byte indicating the data type (null, true, false, int, float, text, array, object) and payload length.
* String keys and values are stored without quotation marks or escape sequences.
* Object members and array items are arranged so that parsers can skip unread branches without scanning every character.

LiteLens automatically detects columns storing JSONB payloads and decodes them into formatted JSON trees for browsing and query filtering.

## Vector Embeddings

Vector search in SQLite relies on extensions like `sqlite-vec` or raw BLOB storage where embeddings are serialized as byte slices of IEEE 754 single-precision floats (32-bit float arrays).

LiteLens includes distance calculation utilities for:
* **Cosine Similarity:** Measures the angle between normalized vectors, useful for text embeddings.
* **L2 Euclidean Distance:** Measures straight-line distance in Euclidean space.
* **Dot Product:** Measures vector magnitude and alignment, commonly used with unit-normalized vectors.

The built-in Vector Playground allows selecting any table column containing vector data, executing similarity calculations against a target vector, and sorting matches by similarity score.
