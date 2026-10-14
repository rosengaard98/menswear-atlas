# Instagram setup

The nightly run prepares one carousel post and opens a GitHub issue labelled **instagram** with the slides and caption. Nothing goes out until you add the **approve** label to that issue; then the "Post to Instagram" workflow publishes it and comments with the link. Close the issue instead to skip a post.

The publishing runs on GitHub, through Instagram's official API, with your key stored as a GitHub secret. The agents never see it.

## One-time setup

1. **Create the account.** Make a new Instagram account for the atlas, then in its settings switch it to a professional account (Creator or Business; both are free). Put `https://rosengaard98.github.io/menswear-atlas/` in the bio link.
2. **Create a Meta app.** At developers.facebook.com, create an app, choose the Business type, and add the **Instagram** product. Under "API setup with Instagram login", add your new Instagram account to the app. Because you are posting to an account you own, you do not need app review.
3. **Get the account's id and a long-lived token** for it from that setup page, with the permissions `instagram_business_basic` and `instagram_business_content_publish`.
4. **Store them on GitHub.** In the repository: Settings, then Secrets and variables, then Actions. Add two repository secrets:
   - `IG_USER_ID`: the Instagram account id
   - `IG_ACCESS_TOKEN`: the long-lived token
5. **Optional: let the token renew itself.** Tokens last 60 days. The "Keep the Instagram token alive" workflow refreshes it every Monday. If Instagram ever hands back a new token, the workflow can only store it if it has permission: create a fine-grained personal access token on GitHub for this repository only, with **Secrets: read and write**, and add it as a third secret, `SECRETS_PAT`. Without it the workflow still refreshes, and warns you if you need to paste a new token by hand.

## Approving a post

Open the issue the nightly run made (the morning email links to it), look at the slides and caption, and add the **approve** label. The workflow posts within a minute or two, comments with the Instagram link, labels the issue **posted** and closes it. If something fails, it comments with the reason and removes **approve**, so you can fix it and add the label again.

To change the caption before approving, edit `caption` in `social/<date>/post.json` on GitHub and commit.
