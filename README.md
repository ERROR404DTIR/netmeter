NetMeter
========

A lightweight, browser-based internet speed and connection diagnostics tool.

Live site: https://error404dtir.github.io/netmeter/

Features
--------
- Measures browser-to-Cloudflare-edge HTTP latency and jitter.
- Measures download and upload throughput using Cloudflare's public speed endpoints.
- Shows browser-reported connection hints when available.
- Draws a live throughput trace and stores the latest ten results in local storage.
- Responsive layout, keyboard focus states, and reduced-motion support.
- No build step, package manager, framework, analytics, or application backend.

Run locally
-----------
Open index.html in a modern browser. For reliable cross-origin testing, serve it over HTTP or HTTPS using any static file server.

Measurement notes
-----------------
NetMeter is a browser-side estimate, not an ICMP ping tool or a laboratory-grade measurement. Latency is an HTTP round-trip to Cloudflare's public speed endpoint; download and upload results depend on the route to the selected Cloudflare edge, browser scheduling, Wi-Fi, VPN, and other traffic. Upload testing may be blocked by some networks or browsers.

Each full run transfers about 24 MB to speed.cloudflare.com using its public download and upload endpoints. NetMeter does not operate a measurement server. Recent result history is stored locally in the browser.

NetMeter is an independent project and is not affiliated with Cloudflare, Ookla, or Speedtest.net.

Deploy
------
This repository is published with GitHub Pages using the workflow in .github/workflows/pages.yml. Pushes to main trigger deployment.

License
-------
MIT. See LICENSE.
