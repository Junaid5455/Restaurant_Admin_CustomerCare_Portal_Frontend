# Step 7.3: backend changes the order pages rely on

The order list, status updates and cancelling work with your backend as it is today. These pages are ready for the rest, but three things in the Django code stop owners from seeing guest details or issuing refunds. Each change below is small.

## 1. Owners can't refund (403)

`PaymentViewSet.refund` in `apps/payments/views.py` only allows the order's customer or a SUPER_ADMIN, so a restaurant owner always gets 403. It also lets a *customer* refund their own payment, which you almost certainly don't want.

```python
@action(detail=True, methods=['post'], url_path='refund')
def refund(self, request, pk=None):
    payment = get_object_or_404(Payment.objects.select_related('order', 'restaurant'), id=pk)
    user = request.user
    allowed = user.role == 'SUPER_ADMIN' or (
        user.role == 'RESTAURANT_OWNER' and payment.restaurant.owner_id == user.id
    )
    if not allowed:
        return Response({"error": "Not authorized"}, status=status.HTTP_403_FORBIDDEN)
    if payment.status != 'COMPLETED':
        return Response({"error": "Only completed payments can be refunded"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = Decimal(str(request.data.get('amount', payment.amount)))
    except InvalidOperation:
        return Response({"error": "Enter a valid amount"}, status=status.HTTP_400_BAD_REQUEST)
    if amount <= 0 or amount > payment.amount:
        return Response({"error": "Refund must be more than 0 and at most the amount paid"}, status=status.HTTP_400_BAD_REQUEST)

    reason = (request.data.get('reason') or '').strip()[:500]
    try:
        PaymentService.process_refund(payment, amount, reason)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    return Response(PaymentSerializer(payment).data)
```

In `PaymentService.process_refund(payment, amount=None, reason='')`, set `payment.refund_reason = reason` next to `refund_amount`, in both the mock and the Stripe branch. Add `refund_reason` and `refunded_at` to `PaymentSerializer.fields`. Use `Decimal` instead of `float`, since `int(amount * 100)` on a float can be off by a cent.

## 2. Orders don't carry guest or payment details

`OrderSerializer` leaves out everything the restaurant needs on the detail page. The pages show whichever of these fields are present, and fall back to a short customer reference without them.

```python
class OrderPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'status', 'payment_method', 'amount', 'currency', 'transaction_id',
                  'paid_at', 'refund_amount', 'refund_reason', 'refunded_at']

class OrderSerializer(serializers.ModelSerializer):
    ...
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.EmailField(source='customer.email', read_only=True)
    customer_phone = serializers.CharField(source='customer.phone_number', read_only=True)  # adjust to your field name
    payment = OrderPaymentSerializer(read_only=True)  # OneToOne reverse; missing for orders with no payment yet

    def get_customer_name(self, obj):
        return obj.customer.get_full_name() or None

    class Meta:
        fields = [..., 'discount_amount', 'coupon_code',
                  'delivery_address', 'delivery_city', 'delivery_postal_code', 'delivery_instructions',
                  'pickup_time', 'table_number', 'number_of_guests', 'customer_notes', 'special_instructions',
                  'placed_at', 'confirmed_at', 'ready_at', 'delivered_at', 'cancelled_at', 'cancellation_reason',
                  'customer_name', 'customer_email', 'customer_phone', 'payment']
```

For a reverse OneToOne, DRF raises `RelatedObjectDoesNotExist` on orders without a payment; use a `SerializerMethodField` returning `None` when `not hasattr(obj, 'payment')`. In `OrderViewSet.get_queryset()` add `.select_related('customer', 'payment')` so the list doesn't run a query per order.

## 3. Security: customers can change order status

`update_status` uses `IsOwnerOfOrder`, and that permission returns True for a customer on their own order. So a customer can POST `status=DELIVERED` or `REFUNDED` on their own order. Restrict the action:

```python
elif self.action == 'update_status':
    permission_classes = [IsRestaurantOwner]  # plus staff/super admin if you want them to
```

(Keep `cancel` open to the customer. The `can_be_cancelled()` check already limits it.)

## Smaller things

- Cash payments stay `PENDING` for ever. Nothing marks them paid when the cash is collected, so they can never become refundable. A `POST /payments/{id}/mark-paid/` for owners would fix it.
- `process_refund` marks the payment `REFUNDED` even for a partial amount, and leaves `Order.status` alone. The UI shows the amount actually refunded, so partial refunds read correctly.
- `OrderViewSet` filters on `status`, `order_type` and `payment_status` only. A `search` (order number, customer name) and a `status__in` filter would let the list offer search across all pages, and an "Active orders" view.
- `RESTAURANT_STAFF` can list orders but `IsOwnerOfOrder` returns False for them on detail, update-status and cancel, so staff accounts can't use these pages yet.
