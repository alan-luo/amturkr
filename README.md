# amturkr
a library for making amazon mturk experiments

## Differences from Experimentr v1:

- 'data' variable is restructured to include only user-added data. This makes development and debugging easier. (Tracking variables are added once the experiment ends.)
- Redone using jQuery instead of D3
  - The advantage is that jQuery is more universal, so most people will have the Google API loaded already from another website. The disadvantage is that if they don't, it marginally increases loading time.
  - Also, it's cleaner from a modular design standpoint, since you use D3 only for data and jQuery only for documents.
- Added a number of usability features
  - Start, next, and finish buttons can all be added from the HTML side (by using #experimentStart, #experimentNext...)
  - Postid elements can be added from the HTML side (#experimentId)
  - Scripts can be attached as handlers through a single document
  - Module system is more flexible
  - A number of places have added string parsing and error handling to ensure the system is as robust as possible
- Added debugging features
  - verbose and Verbose modes
  - Can start page from a certain module
- Added mouse tracking for both position and clicks
  - Can globally monitor clicks or only monitor certain elements
  
## Work-in-Progress features

- CSV save support
- Automatic form validation
