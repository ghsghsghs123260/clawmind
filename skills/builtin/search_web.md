# Search Web

## Description

Search the web using a search engine and return the top results.

## Trigger

- **Keywords:** search, google, find, lookup
- **Pattern:** search for {query}
- **Pattern:** find {query} on the web
- **Pattern:** google {query}

## Parameters

- **query** (string, required): The search query
- **limit** (number, optional): Maximum number of results to return (default: 5)

## Actions

### Step 1

- **Action:** browser.open
- **url:** `https://www.google.com/search?q={{query}}`

### Step 2

- **Action:** browser.wait_for
- **selector:** `#search`
- **timeout:** `5000`

### Step 3

- **Action:** browser.extract
- **selector:** `.g`
- **limit:** `{{limit}}`
- **fields:** `title, url, description`

### Step 4

- **Action:** browser.close

## Examples

### Example 1

**Input:** search for Python tutorials

**Output:** Found 5 results for "Python tutorials"

### Example 2

**Input:** google machine learning

**Output:** Found 5 results for "machine learning"
