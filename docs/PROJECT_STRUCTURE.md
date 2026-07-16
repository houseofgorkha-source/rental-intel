# RentalIntel Project Structure

## app/

### /

Homepage

### /property/[slug]

Property details

### /property/[slug]/review

Write a review

### /property/[slug]/review/success

Review submitted successfully

### /add-property

Submit a new property

---

## components/

### SearchBar.tsx

Homepage search and autocomplete.

### review/

Review related reusable components.

- ReviewForm
- StarRating
- reviewCategories

### add-property/

Reusable property submission components.

- PropertyForm
- InputField
- TextAreaField
- SectionTitle
- InfoCard

---

## data/

Temporary data before Supabase.

- properties.ts
- reviews.ts

---

## docs/

Blueprint
Architecture
Roadmap
Project Structure
