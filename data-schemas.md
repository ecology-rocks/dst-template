## Blanks
```js
{
  "name": "Gildan 64000",
  "ownerId": "admin_uid_here",
  "isPublic": true,
  "category": "Apparel",
  "subCategory": "T-shirts",
  "defaultPhotoUrl": "gs://your-bucket/blanks/gildan-default.jpg",
  "variants": [
    {
      "sku": "gildan-64000-black", 
      "color": "Black",
      "minSize": "S",
      "maxSize": "3XL",
      "tone": "darkGarment",
      "basePrice": 1500, 
      "mockupUrls": [
         "gs://...", "gs://..." 
      ]
    }
  ],
  "isActive": true,
  "createdAt": "timestamp"
}
```

## Products

```js
{
  "designId": "reference_to_design_doc",
  "blankId": "reference_to_blank_doc",
  "title": "Agility Jump Silhouette - Gildan 18000 Crewneck",
  "generatedMockups": {
    "Black": "gs://your-bucket/mockups/prod_abc_black.jpg",
    "Ash": "gs://your-bucket/mockups/prod_abc_ash.jpg"
  },
  "availableVariants": [
    // Copies over the variants from the blank, perhaps with your retail markup applied
    { "sku": "18000-BLK-M", "color": "Black", "size": "M", "retailPrice": 3500 }
  ],
  "isActive": true,
  "createdAt": "timestamp"
}
```

## Designs
```js
{
  "name": "Agility Jump Silhouette",
  "assets": {
    "default": "gs://your-bucket/designs/agility-jump-01-dark-ink.png",
    "lightGarment": "gs://your-bucket/designs/agility-jump-01-dark-ink.png",
    "darkGarment": "gs://your-bucket/designs/agility-jump-01-light-ink.png"
  },
  "tags": ["agility", "dog sports"],
  "uploadedAt": "timestamp",
  assignedBlankIds: []
}
```