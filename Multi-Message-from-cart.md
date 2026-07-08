# Implementation Plan: Unified Shopper Cart with Multi-Store WhatsApp Checkout (Revised)

We will build a unified client-side Cart page (`/cart`) where buyers can view all their items from `localStorage`, grouped by store. This revised plan incorporates validation against stale database data, explicit edge cases for WhatsApp redirects, and a return-to-tab confirmation flow.

---

## Technical Specifications & Feedback Resolutions

### 1. Cart Clearing Flow
- **Interaction**: Clicking "Order via WhatsApp" will open the `wa.me` deep link in a new tab. 
- **Tab-Return Prompt**: The parent cart tab will remain open but display a contextual overlay/banner for that specific shop group:
  > **Did you send the message to [Store Name]?**  
  > *Opening WhatsApp drafts your order, but doesn't guarantee completion.*  
  > [Clear These Items] [Keep in Cart]
- **Manual Control**: Each shop group will have a "Clear Store Cart" trashcan icon, and each individual item line will have a delete button.

### 2. Confirmed `localStorage` Schema
We will continue using the existing schema format established by `StoreCartWidget`. The items are stored as JSON arrays under keys prefixed by `seyon_cart:${shopId}`:
- **Key**: `seyon_cart:[shopId]` (e.g. `seyon_cart:clp8y32a100003b5x...`)
- **Value**: JSON array of `CartItem`:
  ```typescript
  export interface CartItem {
    productId: string;
    title: string;
    price: number;      // Price at the time it was added to cart
    image?: string;
    quantity: number;
    selections: Record<string, string>; // e.g. { "Size": "M", "Color": "Blue" }
    selectionsKey: string;             // e.g. "color:blue|size:m"
  }
  ```

### 3. API Input Shape & Stale Data Validation (`POST /api/cart/validate`)
To prevent buyers from ordering deleted, modified, or out-of-stock products, the `/cart` page will perform a real-time validation check on mount.
- **Method**: `POST`
- **Path**: `/api/cart/validate`
- **Payload**:
  ```json
  {
    "items": [
      { "productId": "prod_123", "shopId": "shop_456" }
    ]
  }
  ```
- **Validation Actions**:
  - The server caps the input array length at 100 items.
  - Queries the database for the listed product IDs and shop IDs.
  - Returns current details:
    ```json
    {
      "shops": {
        "shop_456": {
          "name": "Earthy Bowls",
          "slug": "earthy-bowls",
          "logo": "https://...",
          "whatsapp": "919876543210",
          "isPaused": false,
          "isSuspended": false
        }
      },
      "products": {
        "prod_123": {
          "price": 299.00,
          "inStock": true,
          "status": "ACTIVE",
          "options": "Size: S, M, L"
        }
      }
    }
    ```
- **Frontend Discrepancy Handling**:
  - **Price Change**: If the database price differs from `item.price`, a warning badge is shown ("Price changed from ₹X to ₹Y"), the local cart price is updated, and the total is recalculated.
  - **Out of Stock / Inactive / Deleted**: A badge is shown ("No longer available") and the checkout button for that shop group is disabled until the invalid item is removed.
  - **Deactivated/Suspended Shop**: If `isSuspended === true`, a warning is shown ("Seller is suspended") and checkout is disabled. If `isPaused === true`, a banner states "Seller is away, orders paused" and checkout is disabled.

### 4. WhatsApp Number Validation
- If a shop has no WhatsApp number or `whatsapp` length is invalid, the checkout button is disabled and replaced with: "No WhatsApp number configured for this store".

### 5. Currency Formatting
- Standard currency is formatted as ₹ (INR) but handled dynamically through a helper function `formatCurrency(amount, code = 'INR')` to keep it future-proof.

### 6. WhatsApp Message Encoding & Length Limits
- The order text is fully URL-encoded using `encodeURIComponent`.
- **Length Constraint**: Browsers and the WhatsApp protocol can fail on extremely long links. We enforce a limit of 1800 characters on the compiled message.
- If the draft message exceeds 1800 characters:
  - We compile the first N items that fit under 1500 characters.
  - We append: `\n... and N more items. Please check the storefront cart for details.`
  - A modal notification will warn the shopper: *"Your cart is very large. We've drafted the first part of your order. Please split your order or copy/paste the items list manually."*

---

## Proposed Changes

### Backend/API

#### [NEW] [route.ts](file:///d:/Projects/Seyon/src/app/api/cart/validate/route.ts)
- Create the validation API route described above.
- Restrict to `POST` request. Validate body format.
- Fetch matching `Shop` and `Product` tables in a batch.

---

### Components & Navigation

#### [MODIFY] [navbar-client.tsx](file:///d:/Projects/Seyon/src/frontend/components/shared/navbar-client.tsx)
- Import `ShoppingCart` from `lucide-react`.
- Add a Cart icon next to the Wishlist link.
- Track active `seyon_cart:*` keys to render a dynamic badge with the total item count.
- Add event listeners for `seyon-cart-updated` to keep the count in sync.

---

### Pages

#### [NEW] [page.tsx](file:///d:/Projects/Seyon/src/app/(shopper)/cart/page.tsx)
- Create a client component page.
- Scan and retrieve all `seyon_cart:*` arrays on mount.
- Make the validation API POST request.
- Display grouping tabs/sections sorted by store.
- Implement quantity adjusting controls (+/-), item removal, and the "Order on WhatsApp" button with tab-return prompts.

---

## Verification Plan

### Manual Verification
1. Add items from two separate storefronts to the cart.
2. Verify the Cart badge count in the header updates instantly.
3. Open `/cart`. Verify correct grouping by seller.
4. Manually mock a database price change in Prisma or through the seller dashboard. Refresh `/cart` and ensure the warning badge highlights the price change and updates totals.
5. Deactivate one of the products in the seller panel. Verify the cart displays "No longer available" and disables the checkout button for that shop.
6. Verify clicking "Order via WhatsApp" launches a new tab with correct pre-text message syntax and phone routing. Confirm parent tab shows the completion check banner.
