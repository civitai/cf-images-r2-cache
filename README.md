# CF Images R2 Cache

Because delivering images from Cloudflare Images is priced all wrong...

Use Workers instead and store results from Images straight into an R2 bucket to save on delivery counts. Now only you will be accessing your images. The only thing better would be to not use Cloudflare Images at all, but the resize functionality is nice :)

## Basically it works like this
0. Request is made with a key that matches a key made in Images
1. Check worker cache for key
2. Check R2 for key
3. Get Image from Images
4. Return Image
5. Save to R2 and Save to Cache
