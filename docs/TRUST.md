# MaxQ CA trust

The persist CA is created on `maxq apply` if missing:

- `$HOME/.config/maxq/ca/maxq-ca.pem`
- `$HOME/.config/maxq/ca/maxq-ca.key`
- `$HOME/.config/maxq/ca/maxq-ca.der`

`maxq revert` does **not** delete this directory. MITM (`[gost] intercept`) stays **false** until you opt in, so ChatGPT and other TLS sessions are not intercepted.

MaxQ does not install the CA into `/usr` and does not write Chrome managed policies.

## Optional system trust

```bash
sudo cp "$HOME/.config/maxq/ca/maxq-ca.pem" /usr/local/share/ca-certificates/maxq-ca.crt
sudo update-ca-certificates
```

## Optional Chrome trust

Import `maxq-ca.pem` as a certificate authority in Chrome settings, or drop your own enterprise `CACertificates` policy. Do not use MaxQ to write `/etc/opt/chrome/policies/managed/` proxy files.

## Enable MITM (after trust)

```bash
maxq proxy intercept on
maxq proxy on
```

Leave intercept off unless you have trusted the CA.
