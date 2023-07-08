# jira-bugzilla Web Extension

[![Node.js CI](https://github.com/mozilla/jira-bugzilla-extension/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mozilla/jira-bugzilla-extension/actions/workflows/ci.yml)

## Current Status

This project is currently in pre-release development.

## Goals

This is extensions is aiming to make it easier to know what items in
Bugzilla have JIRA tickets.

The currently functionality is focused on Bugzilla, but it's possible if
needed that similar parallel functionality could be extended to JIRA as well.

## Features

Here's an overview of the existing feature-set.

### On Buglists

- In any buglist (buglist.cgi) it shows JIRA links in the last column if the corresponding bug has a JIRA link.

### On Bug pages

- In any bug view it adds a JIRA link next to the bug id.
- The page Action is shown and you can click that to make a comparison between JIRA and Bugzilla data for the current issue.

## How it works

- The extension has a content script which is injected into Bugzilla by the background script.
- There's a page action that shows a corresponding popup.
- There's a background script that controls everything.

### The background script

This background script has a few different roles.

It contains a content script that's injected into bugzilla pages, the content
script introspects various bits of data needed.

The Pages that are injected into are currently buglists (buglist.cgi) and the
main bug page (show_bug.cgi).

## buglist.cgi

The content script gets the REST API URL from the link in buglist.cgi, this makes
it easier to ensure that the API data matches up to the request. That said the REST
API call won't necessarily match the same sort as the web-page response.

This means that the API response could request the same number of entries but get different entries.

To fix that we're currently looking up the sort params from the search edit form to ensure the sort on the REST call matches the web-page.

The API request returns `see_also` data which is then introspected for JIRA links. These are then
used to populate the last column of the buglist table.

## show_bug.cgi

Here'we we're just looking to grab the bug from the URL and then we write the JIRA link into the page.
The BZ bug id and the Jira link are passed back to the background script so that these can be used by the popup script
in the page action.

For editing bugs, with the right configuration, configured whiteboard tags are made availble. In the future this will be based on user configuration.

## enter_bug.cgi

When entering bugs, if the configuration matches the component (as mentioned above), configured whiteboard tags are made available when adding a new bug.

### The popup script

When activated from the page action a message is sent to the background script to ask it for comparison data.

This then makes queries to both Bugzilla and JIRA to build the relevant data.

## Have a bug or feature request?

Please file an issue on this repo.
