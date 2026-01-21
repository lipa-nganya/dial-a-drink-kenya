#!/bin/bash
# Script to set Firebase environment variables on Cloud Run
# Run this script manually in your terminal: bash set-firebase-env-vars.sh

set -e

echo "🔧 Setting Firebase environment variables on Cloud Run..."
echo ""

# Set project
gcloud config set project drink-suite

# Set environment variables on Cloud Run service
gcloud run services update deliveryos-backend \
  --region=us-central1 \
  --set-env-vars="FIREBASE_PROJECT_ID=drink-suite,FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@drink-suite.iam.gserviceaccount.com,FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDReFMCUT/fRmBy
Fn152gFbnox6qENAkpgn40t6oWcXqhFj+pbWSfm8BsQNXd1aHJN3/vIdNIO6IyxS
fFI5naY8C/bC6o6AAoiUQKQNhynpqSdBvKeM+nSYdtbzfDQbFEDEeGcQB5yEHvt2
6kmMtxSGayX6C/CReg5nRDZR3tyQv5wpz9d06sgIdd9OzMkOFdqGZnPbEaQxFjBK
1G/Aw6tdk7+L9M1Y7enGcRvEldxKg9UlKq92l0YqQMpRtuKveKCISNYcWJ7dIxIB
y5paAaE0M2K7PRmtjyriJpH2Ju9uGKRZ7WJt0QM2+Ek6CPh4plIeaCKbMkbSUHJ5
mM67xXuRAgMBAAECggEADfz7ih2T5tyjxyqiUXdR/OTPG8fNyeugNpWyritGH6nv
RF5xITlKcJiBEiVxCTn8TRic4X9mxpDfvlhoA0n4Vm00GtsgDgNdTI0uh2q9zUlL
AlRPWhZFoALbouHp9t743kXuF/9yH86T22KU6800FS/llteiRozAlnvTJs97qjzK
eRxFgWWqytmzaC/g0kVs03XKAaxG5Os2Vg/a16jNVoYi4wq9IqpCZcPnJUUAgxVB
jWIC11aR1gC6ib0aLnI+ns7rxm6LqpF2ZnbNlWpz95AcZ54aOL60k0clEnJHOFC/
14FvlfUoOPN4XLFIkBbqYXoY/Y8RnFvV+N4rMgkuUwKBgQD3jWdNcG7XTyYo8vVI
C6AcuSQoNIuMTQ8qVt4dr/JLCIGQfSU0mTUMRYfgm/tZI10+xM+P6gaX50xcnG2c
t6SZXKERPfXgPzF80N76cJqPu17WDjSSPO9vaHq0aALhgWKnf+EL9FzvRelkeEcP
+jaTLlO4FnHi2hOuDzExrHfUJwKBgQDYnjyS7ZLUaWEg6Z16KDQa7msgXfHz58PM
aGm8O10te1PoRPgfcAAqgoCIGQGXiH+qjHxzrC++3qInbeLEUBI0F0wEFI/WgVUc
0HSXecshJcOPD5EBaMo9KHBxr8EpAINSj2SwH4EckC4y7MV9mmXkLPk32niqqgih
KTRl6sBthwKBgHTOIL8WXQZ0zzGlKf0blynWZewelvXVamF06YsiePXUhqXxlruR
yskGic1+bAOsPxQd8z4Zk5DbT1mnacT3lc/TOCCVls1/o88cEwoiVZuaMm5X95BE
9kkgCD3Vkf5reWxFV5+3Zp5z42NHqWgtjNC3nEMRPB1o/r4zZufkVAojAoGATnlU
vG2wqZ7bfw7i6+QwrCj/SiR+iLvHpP+WfoiLAvUQuq5xrQHoLX5FjghxGTJr/Z8T
XtxcF6uT1vDqG/BeB90AvuGsEiucZ+nksxN+US3bILKk93u8+Fb0FVt0gKQc7wXf
liZzoaNh+TTpfs02aGkah+9vk3Qx2CCTSPC4cXUCgYBriXRkqoDrO7a5Zbj2PSp+
5dgx7ZGVJP0TSoWn7pmR8sq4UoVhq1s1hkmJYvSQZ67iqzKwVy8JFE0vMT7+KrS0
Aq+wSh1J/uov7UX0oKQVZs78ey9vbxvP9ancRpHTQOshXysWHKCmWk+Y8XPy6XS0
u4XOhtfNGn5hxosHDCrbJA==
-----END PRIVATE KEY-----"

echo ""
echo "✅ Firebase environment variables set successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Check Cloud Run logs to verify Firebase initialization"
echo "   2. Test push notifications from the admin panel"
echo "   3. Look for: '✅ Firebase Admin SDK initialized from environment variables' in logs"