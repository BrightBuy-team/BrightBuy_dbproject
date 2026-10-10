# BrightBuy user guide

BrightBuy has five kinds of user. Each section says what that user can do and where.

## Guests

Open the shop at `/catalogue.html`. Without an account you can:

- browse all products, or pick a category from the bar under the header;
- search by name, brand or SKU, filter by price and stock, and sort the results;
- open a product, choose a variant (colour, memory size) and see its price and stock;
- order an item that is out of stock: it is back-ordered and delivery takes 3 days longer;
- add items to the cart. The cart is kept in this browser tab only.

To place an order you need an account. Your cart is kept when you register or sign in.

## Customers

**Register.** Choose *Sign in*, then *Create an account*. Enter your name, email and a
password of at least 8 characters. Phone, delivery address and city are optional and can
be entered at checkout instead.

**Sign in.** Enter your email and password and leave the account type on *Customer*.
After five wrong passwords within 15 minutes, sign-in for that email pauses for a while.

**Forgot your password.** Choose *Forgot your password?*, enter your email, and you are
sent a one-time code that is valid for 30 minutes. Enter the code with your new password.

**Order.**

1. Open *Cart*, adjust quantities, and choose *Proceed to Checkout*.
2. Choose *Delivery* or *Store pickup*. For delivery, choose the city and enter the
   address; the estimated delivery date appears as soon as a city is chosen. Delivery
   takes 5 days to a main city and 7 days elsewhere, plus 3 days if an item is out of stock.
3. Choose *Cash on delivery* or *Card*. For a card, enter the number, expiry date,
   security code and the name on the card.
4. Choose *Place order*. Prices and stock are checked again at this moment. If an item
   has just sold out, the order still goes through: that item is back-ordered and the
   delivery date moves 3 days later. If a card is declined or an item is no longer sold,
   the page says so and nothing is charged.
5. The confirmation shows the order number, the items (with any units on back-order), the
   delivery details and the payment status. A confirmation email is sent as well.

You can order up to 100 units of one item in one order.

**Your orders.** *My orders* lists every order with its items, the price paid, the
delivery estimate and status, and the payment status.

**Delivery estimate of an order.** The *Delivery* page shows the estimate recorded for
one of your order numbers.

## Warehouse staff

Sign in with the account type *Employee*. You land on the warehouse page (`/inventory.html`).

- **Low stock alerts** lists every variant with fewer than 10 units. Type the counted
  quantity and choose *Restock*.
- **Full inventory** lists every variant with its product, SKU, price and stock. Type a
  quantity and choose *Save* to set the stock. Every change is recorded with your account,
  the time, and the quantity before and after.
- **Add a variant** creates a new version of an existing product: enter the product ID,
  a name, colour, memory size, price and opening stock. All stock is held in the one
  central warehouse, so there is no warehouse to choose.
- **Edit** next to a variant changes its name, colour, memory size or price.

Products and categories are maintained under *Catalogue staff* in the shop header:

- **Create product** needs a SKU, a name, a first category, and the price and stock of
  its first variant. All of them are saved together or not at all.
- **Edit** changes a product's SKU, name, description or image address.
- **Retire** hides a product from customers. Products are never deleted, because old
  orders refer to them. **Restore** brings a retired product back.
- **Categories** can be created and edited. A category is either a top-level category
  or a child of one; deeper levels are not allowed.
- **Product category membership** puts a product in another category or takes it out.
  A product always keeps at least one category.

## Management

Sign in with the account type *Employee*. You land on *Reports*.

| Report | Shows | Options |
|---|---|---|
| Quarterly sales | Orders and revenue for each quarter | Year |
| Top products | Best-selling products | Date range, how many |
| Category orders | Number of orders per category | |
| Delivery estimates | Orders still on their way, with estimated dates | |
| Customer summary | Each customer's total spend and payment statuses | |

Choose a report, set its options and choose *Run report*. *Export CSV* downloads the
rows on screen for a spreadsheet. Reports only read data; each run is recorded with
your account. Cancelled orders are left out of the totals.

## Administrators

Sign in with the account type *Employee*. You land on *Admin*.

**Create an employee.** Enter the person's name and email, a temporary password of at
least 8 characters, and the role: warehouse staff, management or admin. Give them the
email and password; they sign in with the account type *Employee*.

Administrators can also do everything warehouse staff can. Reports are for management
accounts only.

## If something goes wrong

| Message | What to do |
|---|---|
| *Please sign in to continue* | Your session ended after 30 minutes without activity. Sign in again |
| *Your account does not have permission for this action* | You are signed in with the wrong kind of account for this page |
| *Stock or records changed. Refresh and try again* | Someone else changed the same thing first. Reload the page |
| *Your card was declined* | No order was placed. Try another card or choose cash on delivery |
| *This service is temporarily unavailable* | Try again in a few minutes |
