# jszlog
## javascript zeroth-order logic

This is a program in javascript, that *runs inside a webpage*. Its purpose is to parse a rules specifications file, and
to set the content of the page accordingly.

Its primary purpose is to teach students the concepts of **logic**, and data-driven *rules* and *actions*.
But you can also use it to compute simple to moderately complex formulas. 
You can put the page in your hospital intranet to comply with regulations.<br>
The rules specification can be passed as an argument, which means **you can can store an entire specification in your favorites**, as a link !
This enables each user to make his own library of formulas, at his taste.

The specifications file has 3 parts : DATA, LOGIC and ACTIONS.

- DATA defines what the user will have to enter, and also some calculations.
- LOGIC defines the logic rules that will interpret the data
- ACTIONS defines the actions that will fire, associated with a rule name

There is a manual at https://hkara01.github.io/jszlog/<br>
You can test the page at https://www.hkmi2.org/jszlog/engine.html?lang=en<br>

To deploy it locally, copy in the same directory of your webserver the 4 files :

- `engine.html`
- `i18n.js`
- `jszlog.js`
- `objects.js`

and point your browser to engine.html with an extra argument of lang=en to get elements in english (default is to have
them in french)

