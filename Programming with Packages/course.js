(function () {
  'use strict';

  const COURSE = 'Programming with Packages';
  const q = (prompt, correct, wrong1, wrong2, explain) => ({ prompt, correct, wrong: [wrong1, wrong2], explain });
  const units = [
    {
      title: 'Package Foundations',
      synthesis: q('What makes a package dependency different from code you wrote locally?', 'Its API and version are controlled outside your project, so you must manage compatibility and trust.', 'It cannot contain functions or classes.', 'It always comes with the programming language.', 'A dependency adds external ownership, versioning, and supply-chain decisions.'),
      lessons: [
        {
          slug: 'packages-modules-apis-and-dependencies', title: 'Packages, Modules, APIs, and Dependencies',
          subtitle: 'Move from writing every operation yourself to composing code through published interfaces.',
          concept: 'A <strong>module</strong> is an importable code unit. A <strong>package</strong> groups modules or distributes reusable software. Its <strong>API</strong> is the public surface callers rely on, while a <strong>dependency</strong> is the package relationship your project must install, version, and trust. The Code Sandbox begins with language fundamentals; this course explains the layer that real applications build on top of them.',
          pattern: 'Treat a package call like a contract: identify the accepted inputs, returned value, mutations, exceptions, and version where that behavior is promised. Implementation details behind the API are not yours to depend on.',
          warning: '“It imported successfully” proves only that a name exists. It does not prove you understand shapes, data types, missing values, side effects, or failure behavior.',
          code: 'import pandas as pd\nseries = pd.Series([4, 7, 9])\nprint(series.mean())',
          source: 'https://packaging.python.org/en/latest/',
          checks: [q('Which term means the public functions, classes, and behavior callers may rely on?', 'API', 'Dependency graph', 'Virtual environment', 'The API is the package’s public contract.'), q('What is a dependency?', 'External software a project relies on.', 'A comment explaining a function.', 'A variable declared inside a loop.', 'Dependencies must be installed and versioned with the project.'), q('Why avoid relying on package implementation details?', 'They may change even when the public API remains supported.', 'They are always slower.', 'They cannot be tested.', 'Public contracts are the stable integration boundary.')]
        },
        {
          slug: 'imports-namespaces-and-reading-documentation', title: 'Imports, Namespaces, and Reading Documentation',
          subtitle: 'An import solves name access; documentation solves correct use.',
          concept: 'Imports bind package objects into a <strong>namespace</strong>. Qualified names such as <code>pd.DataFrame</code> preserve where an object came from and prevent collisions. Documentation should be read in layers: signature, parameter types, return type, examples, edge cases, and version notes. Search for the exact object, not a vague task description.',
          pattern: 'Before using an unfamiliar method, write a tiny probe with representative normal, empty, and malformed inputs. Inspect the type, shape, labels, and whether the original object changed.',
          warning: 'Copying an example without reading parameter defaults is dangerous. Defaults control join types, missing-value behavior, sorting, axis direction, and many other results.',
          code: 'import pandas as pd\nframe = pd.DataFrame({"score": [80, 95]})\nresult = frame["score"].mean()\nprint(type(result), result)',
          source: 'https://pandas.pydata.org/docs/user_guide/',
          checks: [q('Why is pd.DataFrame clearer than importing DataFrame without qualification?', 'It preserves the object’s package namespace.', 'It installs pandas automatically.', 'It prevents all runtime errors.', 'Qualified names communicate origin and reduce collisions.'), q('What should you inspect immediately after a package call?', 'Return type, shape or structure, labels, and mutation behavior.', 'Only execution speed.', 'Only the first printed value.', 'Correct package work starts by verifying the produced structure.'), q('What is the best first documentation target?', 'The exact function or class being called.', 'A random tutorial using the same language.', 'The package homepage logo.', 'The object reference describes its actual contract.')]
        },
        {
          slug: 'versions-environments-and-lockfiles', title: 'Versions, Environments, and Lockfiles',
          subtitle: 'Make “works on my machine” reproducible instead of accidental.',
          concept: 'A package environment is part of the program. <strong>Semantic versions</strong> communicate change, constraints describe acceptable versions, and a <strong>lockfile</strong> records the exact resolved dependency graph. Isolated environments keep one project’s upgrades from silently changing another project.',
          pattern: 'Declare direct dependencies, resolve exact transitive versions, commit the manifest and lockfile, and rebuild the environment from those files in testing. Upgrade deliberately in a separate change with tests.',
          warning: 'A broad version range without a lockfile makes two installations on different days potentially produce different programs. Installing globally creates the same problem across projects.',
          code: 'python3 -m venv .venv\npython3 -m pip install pandas\npython3 -m pip freeze > requirements.txt',
          source: 'https://packaging.python.org/en/latest/tutorials/installing-packages/',
          checks: [q('What problem does an isolated environment solve?', 'Different projects can use independent dependency versions.', 'It makes all algorithms O(1).', 'It removes the need for tests.', 'Isolation prevents one project’s package changes from affecting another.'), q('What does a lockfile record?', 'Exact resolved dependency versions.', 'Only the project title.', 'Every line of source code.', 'Exact resolution makes installations repeatable.'), q('When should dependencies be upgraded?', 'Deliberately, with tests and review.', 'Automatically on every program start.', 'Only after deleting the manifest.', 'Controlled upgrades make regressions attributable and reversible.')]
        }
      ]
    },
    {
      title: 'Package Ecosystems Across the Sandbox Languages',
      synthesis: q('What artifact plays the same general role across pip, Maven, npm, and C++ build tools?', 'A dependency manifest describing required external components.', 'A loop counter.', 'A runtime stack trace.', 'Syntax differs, but each ecosystem needs a declared dependency graph.'),
      lessons: [
        {
          slug: 'python-packages-pip-venv-and-imports', title: 'Python Packages: pip, venv, and Imports',
          subtitle: 'Connect the Python Sandbox’s functions and collections to installed, importable distributions.',
          concept: 'Python distinguishes an installable <strong>distribution package</strong> from an import package containing modules. <code>pip</code> installs distributions, <code>venv</code> isolates them, and <code>import</code> loads modules at runtime. The interpreter running pip must be the interpreter running the program, which is why <code>python -m pip</code> is safer than a bare pip command.',
          pattern: 'Create one environment per project, activate it, install declared dependencies, and verify with <code>python -m pip show</code> or an import/version probe. Use aliases only when community conventions make code clearer, such as <code>import pandas as pd</code>.',
          warning: 'The Code Sandbox supplies its named runtime and intentionally blocks arbitrary installation. Local package work requires your own isolated environment; sandbox code should never assume access to files, network, or undeclared libraries.',
          code: 'python3 -m venv .venv\nsource .venv/bin/activate\npython -m pip install pandas\npython -c "import pandas; print(pandas.__version__)"',
          source: 'https://packaging.python.org/guides/installing-using-pip-and-virtual-environments/',
          checks: [q('Why prefer python -m pip?', 'It targets pip belonging to the selected Python interpreter.', 'It makes packages free.', 'It disables version checks.', 'The command ties installation to the interpreter you intend to run.'), q('What does venv isolate?', 'A project’s Python interpreter context and installed packages.', 'The computer’s network adapter.', 'JavaScript browser storage.', 'Each environment has its own package installation location.'), q('What does import do?', 'Loads and binds an importable module at runtime.', 'Downloads a package from PyPI.', 'Creates a virtual environment.', 'Installation and importing are separate stages.')]
        },
        {
          slug: 'java-dependencies-maven-gradle-and-jars', title: 'Java Dependencies: Maven, Gradle, and JARs',
          subtitle: 'Move from single-file Main classes to repeatable classpaths and transitive dependency graphs.',
          concept: 'Java libraries are commonly distributed as <strong>JAR</strong> files. Maven declares coordinates—group, artifact, version—in <code>pom.xml</code>; Gradle expresses the same graph in a build script. Repositories provide artifacts, scopes separate production and test needs, and transitive dependencies bring in packages required by direct dependencies.',
          pattern: 'Declare every library your source uses directly, inspect the dependency tree, keep test-only tools out of production scope, and resolve version conflicts explicitly rather than trusting classpath order.',
          warning: 'Manually downloading JARs into a random folder hides their versions and transitive requirements. A build may work locally but fail anywhere the invisible classpath differs.',
          code: '<dependency>\n  <groupId>org.example</groupId>\n  <artifactId>analytics</artifactId>\n  <version>2.1.0</version>\n</dependency>',
          source: 'https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html',
          checks: [q('What three Maven coordinates identify a dependency?', 'Group ID, artifact ID, and version.', 'Class, method, and variable.', 'Host, port, and protocol.', 'Coordinates locate one artifact version in a repository.'), q('What is a transitive dependency?', 'A dependency required by another dependency.', 'A local variable passed between methods.', 'A package installed without permission.', 'Dependency graphs extend beyond the libraries declared directly.'), q('Why use dependency scopes?', 'To separate compile, runtime, and test needs.', 'To rename Java classes.', 'To avoid all versioning.', 'Scopes keep tools in the stages where they belong.')]
        },
        {
          slug: 'javascript-and-cpp-package-ecosystems', title: 'JavaScript and C++ Package Ecosystems',
          subtitle: 'Compare npm’s standardized registry workflow with C++’s build-system-centered library model.',
          concept: 'JavaScript projects declare runtime <code>dependencies</code> and development-only <code>devDependencies</code> in <code>package.json</code>, while a lockfile captures exact resolution. C++ has no single universal package workflow: headers expose declarations, compiled libraries provide definitions, and build systems such as CMake connect source, include paths, libraries, and toolchain settings.',
          pattern: 'In JavaScript, import only declared packages and commit the lockfile. In C++, let the build target carry include directories and linked libraries instead of placing machine-specific paths in source code.',
          warning: 'A JavaScript package’s install script can execute code, and a C++ binary must match the platform and ABI. Package trust includes build behavior—not merely the function you plan to call.',
          code: '{\n  "dependencies": {"library": "1.4.2"},\n  "devDependencies": {"test-tool": "3.0.0"}\n}\n\ntarget_link_libraries(app PRIVATE library)',
          source: 'https://docs.npmjs.com/specifying-dependencies-and-devdependencies-in-a-package-json-file/',
          checks: [q('Where are npm runtime dependencies declared?', 'The dependencies field of package.json.', 'Inside every JavaScript function.', 'A CMakeLists.txt file.', 'package.json is the JavaScript dependency manifest.'), q('What does target_link_libraries express in CMake?', 'Which compiled libraries a build target links against.', 'Which browser tab runs JavaScript.', 'Which Python environment is active.', 'CMake attaches library requirements to a target.'), q('Why are C++ binary packages platform-sensitive?', 'Compiled code must match platform, architecture, compiler, and ABI expectations.', 'C++ has no functions.', 'Headers cannot contain text.', 'Binary compatibility is part of C++ dependency resolution.')]
        }
      ]
    },
    {
      title: 'Pandas Foundations',
      synthesis: q('What is the central alignment rule behind pandas operations?', 'Labels participate in selecting and combining data, not only physical position.', 'Every table must use integer labels.', 'Rows are always combined by file order.', 'Index and column labels are active parts of pandas semantics.'),
      lessons: [
        {
          slug: 'series-indexes-arithmetic-and-summaries', title: 'Series: Indexes, Arithmetic, and Summaries',
          subtitle: 'A one-dimensional labeled array is more than a Python list with extra methods.',
          concept: 'A <code>Series</code> stores values plus an index. Selection may use labels or positions, vectorized arithmetic operates over all values, and arithmetic between Series aligns labels before calculating. Summaries such as <code>sum</code>, <code>mean</code>, <code>min</code>, <code>max</code>, and <code>value_counts</code> reduce or count values while accounting for missing data rules.',
          pattern: 'Inspect <code>dtype</code>, <code>index</code>, and missing values before calculation. Use <code>.loc</code> for labels and <code>.iloc</code> for positions; do not make the reader guess which meaning an integer has.',
          warning: 'Two Series of equal length can still produce missing results when their labels differ. Pandas aligns labels; it does not blindly zip physical positions.',
          code: 'scores = pd.Series({"Ada": 92, "Lin": 84})\nbonus = pd.Series({"Lin": 3, "Ada": 2})\nprint(scores + bonus)',
          source: 'https://pandas.pydata.org/docs/user_guide/dsintro.html',
          checks: [q('What two components define a Series?', 'Values and an index.', 'Rows and SQL joins.', 'A compiler and linker.', 'A Series is a labeled one-dimensional array.'), q('How does Series arithmetic match values?', 'By index label.', 'Only by physical position.', 'Randomly.', 'Alignment occurs before arithmetic.'), q('Which accessor selects by physical position?', 'iloc', 'loc', 'groupby', 'iloc is explicitly position-based.')]
        },
        {
          slug: 'dataframe-construction-schema-and-columns', title: 'DataFrame Construction, Schema, and Columns',
          subtitle: 'A table’s shape, labels, and dtypes form a schema whether you declare one or not.',
          concept: 'A <code>DataFrame</code> is a two-dimensional labeled table whose columns may use different dtypes. Constructing from dictionaries makes column intent explicit. The <code>shape</code>, <code>columns</code>, <code>dtypes</code>, <code>head</code>, and <code>info</code> views answer different structural questions before analysis begins.',
          pattern: 'Validate required columns and types at the boundary. Keep observations in rows and variables in columns. Assign a transformed result deliberately rather than relying on ambiguous chained mutation.',
          warning: 'A column containing one malformed string may force an entire numeric column into a broader dtype. Calculations can then fail late or compare lexicographically.',
          code: 'frame = pd.DataFrame({\n    "course": ["Python", "Java"],\n    "score": [91, 86]\n})\nprint(frame.shape, frame.dtypes)',
          source: 'https://pandas.pydata.org/docs/user_guide/10min.html',
          checks: [q('What does DataFrame.shape return?', 'A row-count, column-count pair.', 'Only column names.', 'The package version.', 'Shape describes the table dimensions.'), q('Why inspect dtypes early?', 'One malformed value can change operations available to a whole column.', 'Dtypes control HTML colors.', 'They install missing packages.', 'Column types determine comparison and calculation behavior.'), q('What layout is usually tidy?', 'One observation per row and one variable per column.', 'Every value in a separate file.', 'All variables combined into one text column.', 'Tidy shape makes selection, grouping, and reshaping predictable.')]
        },
        {
          slug: 'selecting-filtering-and-assigning', title: 'Selecting, Filtering, and Assigning',
          subtitle: 'Express exactly which rows and columns should change—and nothing else.',
          concept: 'Bracket selection chooses columns, boolean masks choose rows, <code>loc</code> combines label-based row and column selection, and <code>iloc</code> uses positions. Vectorized comparisons build masks without Python loops. Assignment should target a clear selection or use <code>assign</code> in a pipeline.',
          pattern: 'Build a named boolean mask, inspect how many rows it selects, and use <code>frame.loc[mask, "column"]</code>. Combine conditions with <code>&amp;</code> or <code>|</code> and parenthesize each comparison.',
          warning: 'Python’s <code>and</code>/<code>or</code> do not combine Series element by element. Chained indexing can also target a temporary object rather than the original DataFrame.',
          code: 'passing = frame["score"] >= 60\nselected = frame.loc[passing, ["course", "score"]]\nframe = frame.assign(passed=passing)',
          source: 'https://pandas.pydata.org/docs/user_guide/indexing.html',
          checks: [q('What does a boolean mask contain?', 'One True/False decision per aligned row.', 'Only column names.', 'Package versions.', 'Masks select rows element by element.'), q('How should two Series comparisons be combined?', 'With parenthesized comparisons and & or |.', 'With Python and or or.', 'With import.', 'Pandas uses element-wise boolean operators.'), q('Why prefer loc for targeted assignment?', 'It states row and column selection in one operation.', 'It automatically downloads data.', 'It converts every value to text.', 'One explicit selection avoids ambiguous chained assignment.')]
        }
      ]
    },
    {
      title: 'Cleaning and Transforming Data',
      synthesis: q('What should happen before filling, dropping, or converting dirty data?', 'Measure and define the rule so cleaning is explicit and auditable.', 'Immediately delete every incomplete row.', 'Convert every column to text.', 'Cleaning decisions need evidence and a documented policy.'),
      lessons: [
        {
          slug: 'missing-data-duplicates-and-validation', title: 'Missing Data, Duplicates, and Validation',
          subtitle: 'Cleaning is a policy decision represented in code, not a button labeled “fix.”',
          concept: 'Missing values appear as <code>NaN</code>, <code>NA</code>, or <code>NaT</code> depending on dtype. <code>isna</code> measures them, <code>dropna</code> removes according to a rule, and <code>fillna</code> replaces according to a defensible assumption. Duplicate rows and duplicate keys are different problems and require different subsets.',
          pattern: 'Profile missingness by column, validate allowed ranges and categories, identify key uniqueness, then apply the smallest transformation that matches the data contract. Record counts before and after.',
          warning: 'Filling every missing number with zero invents measurements. Dropping every incomplete row can bias the sample. Neither is neutral.',
          code: 'missing = frame.isna().sum()\nframe = frame.drop_duplicates(subset=["student_id"])\nframe["score"] = frame["score"].fillna(frame["score"].median())',
          source: 'https://pandas.pydata.org/docs/user_guide/missing_data.html',
          checks: [q('What does isna measure?', 'Which values are missing.', 'Which dependencies are outdated.', 'Which rows are sorted.', 'isna creates missing-value indicators.'), q('Why is fillna(0) not automatically correct?', 'Zero may be a real value and filling it invents data.', 'Pandas forbids zeros.', 'It always deletes the column.', 'Imputation must match the meaning of the variable.'), q('Why give drop_duplicates a subset?', 'To define which fields identify a duplicate for this task.', 'To install a subset of pandas.', 'To sort values descending.', 'Duplicate identity depends on the business key.')]
        },
        {
          slug: 'sorting-labels-types-and-categories', title: 'Sorting, Labels, Types, and Categories',
          subtitle: 'Put values into a trustworthy type and order before asking analytical questions.',
          concept: '<code>sort_values</code> orders by data, while <code>sort_index</code> orders labels. <code>rename</code> makes schema meaning explicit. <code>to_numeric</code> and <code>astype</code> convert types, and categorical dtype represents a controlled set of labels—optionally with an intentional order.',
          pattern: 'Normalize column names once, parse values with explicit error handling, check conversion failures, then sort with named keys and tie-breakers. Stable, deterministic ordering makes tests and reports repeatable.',
          warning: 'Sorting numbers stored as strings puts “100” before “20.” Converting with silent coercion can turn malformed inputs into missing values that disappear from later summaries.',
          code: 'frame = frame.rename(columns=str.lower)\nframe["score"] = pd.to_numeric(frame["score"], errors="coerce")\nframe = frame.sort_values(["course", "score"], ascending=[True, False])',
          source: 'https://pandas.pydata.org/docs/user_guide/basics.html',
          checks: [q('What is the difference between sort_values and sort_index?', 'One orders data values; the other orders labels.', 'One imports pandas; the other installs it.', 'There is no difference.', 'Values and labels are separate ordering targets.'), q('Why parse numeric strings before sorting?', 'Text order and numeric order differ.', 'Numbers cannot be displayed.', 'Parsing removes all missing values.', 'Correct dtype gives comparisons the intended meaning.'), q('When is categorical dtype useful?', 'When values come from a controlled set, possibly with an order.', 'For arbitrary executable code.', 'Only for timestamps.', 'Categories encode allowed labels and ordering compactly.')]
        },
        {
          slug: 'vectorized-text-dates-and-times', title: 'Vectorized Text, Dates, and Times',
          subtitle: 'Turn strings into structured values before analysis.',
          concept: 'The <code>.str</code> accessor applies vectorized text operations with missing-value awareness. <code>to_datetime</code> parses temporal text into datetime dtype, after which <code>.dt</code> exposes components and timedeltas represent durations. Formats, time zones, and invalid dates must be explicit at boundaries.',
          pattern: 'Normalize text with strip/case operations, parse dates once, inspect failures, and perform comparisons on typed datetime values rather than formatted strings. Preserve the original raw column when auditability matters.',
          warning: 'Ambiguous dates such as 03/04/05 cannot be parsed correctly without context. Removing time-zone information changes meaning, not merely display.',
          code: 'frame["name"] = frame["name"].str.strip().str.title()\nframe["when"] = pd.to_datetime(frame["when"], errors="coerce", utc=True)\nframe["month"] = frame["when"].dt.month',
          source: 'https://pandas.pydata.org/docs/user_guide/text.html',
          checks: [q('What does the str accessor provide?', 'Vectorized string operations on a Series.', 'A package installer.', 'SQL transactions.', 'str applies text methods across aligned values.'), q('Why call to_datetime?', 'To turn text into values with temporal semantics.', 'To sort every column.', 'To remove all time zones automatically.', 'Typed datetimes support valid comparison and resampling.'), q('Why is an ambiguous date format dangerous?', 'The same text can represent different calendar dates.', 'Pandas cannot store dates.', 'It changes integers into arrays.', 'Parsing needs a known convention or explicit format.')]
        }
      ]
    },
    {
      title: 'Aggregation and GroupBy',
      synthesis: q('What determines whether GroupBy should use agg, transform, or filter?', 'The desired output shape relative to each group and the original rows.', 'The color of the DataFrame.', 'The installed Python patch version only.', 'Aggregation reduces, transform preserves row shape, and filter keeps or removes groups.'),
      lessons: [
        {
          slug: 'aggregation-and-descriptive-summaries', title: 'Aggregation and Descriptive Summaries',
          subtitle: 'Reduce many observations to a statistic without losing track of what was excluded.',
          concept: 'Aggregations such as count, sum, mean, median, min, max, quantile, and standard deviation answer different questions. <code>count</code> excludes missing values while <code>size</code> counts rows. <code>agg</code> computes multiple named statistics in one explicit operation.',
          pattern: 'State the population, column, missing-value rule, and statistic in plain language before writing code. Return named outputs so the report preserves meaning.',
          warning: 'An average without a count can hide that almost every observation was missing. A mean can also be dominated by outliers where a median tells the typical story better.',
          code: 'summary = frame["score"].agg(["count", "mean", "median", "min", "max"])\nprint(summary)',
          source: 'https://pandas.pydata.org/docs/user_guide/basics.html#descriptive-statistics',
          checks: [q('How does count differ from size?', 'count excludes missing values; size counts rows.', 'count sorts; size joins.', 'They always differ by one.', 'Missing-value behavior distinguishes them.'), q('Why include a count beside an average?', 'It reveals how many observations support the statistic.', 'It changes mean into median.', 'It installs an aggregation package.', 'Sample size is essential context.'), q('What does agg enable?', 'Multiple explicit aggregation functions in one operation.', 'Only row selection.', 'Only package installation.', 'agg builds a named summary from reducers.')]
        },
        {
          slug: 'groupby-split-apply-combine', title: 'GroupBy: Split, Apply, Combine',
          subtitle: 'Partition rows by keys, calculate inside each partition, and combine labeled results.',
          concept: '<code>groupby</code> creates groups from one or more keys. An aggregation reduces each group to summaries. Named aggregation gives stable column names, <code>as_index</code> controls whether group keys become index levels, and missing group keys require an explicit policy.',
          pattern: 'Select only grouping keys and measured columns, use built-in aggregations when possible, name outputs, then verify that group counts reconcile with the input.',
          warning: '<code>apply</code> can run arbitrary Python and return unpredictable shapes. Reach for <code>agg</code>, <code>transform</code>, or vectorized operations first.',
          code: 'report = frame.groupby("course", as_index=False).agg(\n    learners=("student_id", "nunique"),\n    average_score=("score", "mean")\n)',
          source: 'https://pandas.pydata.org/docs/reference/groupby.html',
          checks: [q('What are GroupBy’s three conceptual stages?', 'Split, apply, and combine.', 'Install, compile, and link.', 'Read, write, and delete.', 'Rows split by keys, calculations run per group, then results combine.'), q('Why use named aggregation?', 'It produces explicit, stable output column names.', 'It disables grouping.', 'It removes every index.', 'Names document each resulting statistic.'), q('What should be checked after grouping?', 'Group counts reconcile with the intended input population.', 'The screen brightness.', 'That every column became text.', 'Validation catches dropped keys and unintended duplication.')]
        },
        {
          slug: 'advanced-groupby-transform-filter-and-multiindex', title: 'Advanced GroupBy: transform, filter, and MultiIndex',
          subtitle: 'Return group knowledge to rows, remove whole groups, and manage multi-key results.',
          concept: '<code>transform</code> returns one aligned value per original row, making within-group normalization possible. <code>filter</code> keeps or removes entire groups based on a group-level condition. Multiple grouping keys may create a <strong>MultiIndex</strong>, which can be useful or reset into ordinary columns.',
          pattern: 'Use transform when the result must align back to each row, agg when each group becomes fewer rows, and filter when the decision applies to a whole group.',
          warning: 'Assigning an aggregated Series back to the original frame often misaligns because its index represents groups, not rows. transform exists for that shape contract.',
          code: 'group_mean = frame.groupby("course")["score"].transform("mean")\nframe["above_group_mean"] = frame["score"] > group_mean\nlarge = frame.groupby("course").filter(lambda group: len(group) >= 3)',
          source: 'https://pandas.pydata.org/docs/user_guide/groupby.html',
          checks: [q('Which operation returns one value aligned to each original row?', 'transform', 'agg', 'merge only', 'transform preserves the original row shape.'), q('What does GroupBy.filter decide?', 'Whether to keep an entire group.', 'How to install pandas.', 'Which package version to lock.', 'The predicate is evaluated at group level.'), q('Why can an aggregated result misalign when assigned to rows?', 'Its index represents groups rather than original row labels.', 'Aggregations cannot return numbers.', 'Rows have no indexes.', 'Shape and labels must match for assignment.')]
        }
      ]
    },
    {
      title: 'Combining and Reshaping Tables',
      synthesis: q('What is the first question before merging two tables?', 'Which keys relate rows and what cardinality should that relationship have?', 'Which table has more colors?', 'Which file was downloaded first?', 'Keys and cardinality define the meaning and expected row count of a join.'),
      lessons: [
        {
          slug: 'concat-merge-and-join-cardinality', title: 'concat, merge, and Join Cardinality',
          subtitle: 'Stack compatible tables or relate records through explicit keys.',
          concept: '<code>concat</code> stacks objects along an axis. <code>merge</code> performs database-style joins using keys, with inner, left, right, and outer choices controlling unmatched rows. Cardinality—one-to-one, one-to-many, or many-to-many—predicts whether row counts stay stable or multiply.',
          pattern: 'Choose join keys deliberately, validate uniqueness on the “one” side, use the <code>validate</code> argument, and inspect unmatched keys with an indicator merge before trusting totals.',
          warning: 'A many-to-many join can create a Cartesian multiplication. The code succeeds, but sums and counts become inflated unless that relationship was intended.',
          code: 'combined = left.merge(\n    right, on="course_id", how="left",\n    validate="many_to_one", indicator=True\n)\nprint(combined["_merge"].value_counts())',
          source: 'https://pandas.pydata.org/docs/user_guide/merging.html',
          checks: [q('When is concat appropriate?', 'Stacking compatible tables along rows or columns.', 'Parsing every date.', 'Installing Java dependencies.', 'concat combines objects by axis rather than relational keys.'), q('What does many_to_one validation assert?', 'Many left rows may match one unique right key.', 'Both sides may contain unlimited duplicates.', 'No rows may match.', 'Cardinality validation guards accidental multiplication.'), q('Why use an indicator merge?', 'To identify matched and unmatched rows.', 'To round numeric columns.', 'To create a virtual environment.', 'The indicator exposes join coverage.')]
        },
        {
          slug: 'relational-analysis-keys-and-duplicates', title: 'Relational Analysis: Keys, Duplicates, and Integrity',
          subtitle: 'A join is a claim about identity, not just a method call.',
          concept: 'A primary key uniquely identifies a record; a foreign key references it. Composite keys use multiple columns. Anti-joins find records missing a match, semi-joins retain records that do match, and reconciliation compares expected and observed row counts and totals.',
          pattern: 'Write assertions for key uniqueness, allowed nulls, referential coverage, and post-join row count. Keep a rejected-record table when unmatched rows require investigation rather than deletion.',
          warning: 'Dropping duplicate keys to make a merge pass hides which record was correct. Duplicate resolution needs a rule—timestamp, priority, aggregation, or human review.',
          code: 'assert customers["customer_id"].is_unique\ncheck = orders.merge(customers[["customer_id"]], how="left", indicator=True)\nunmatched = check.loc[check["_merge"] == "left_only"]',
          source: 'https://pandas.pydata.org/docs/user_guide/merging.html',
          checks: [q('What property must a primary key have?', 'It uniquely identifies a record.', 'It must always be a timestamp.', 'It contains every table column.', 'Uniqueness gives records stable identity.'), q('What does an anti-join find?', 'Rows without a match in the other table.', 'Only duplicated numeric values.', 'Package security advisories.', 'Anti-joins isolate missing relationships.'), q('Why not simply drop duplicate keys?', 'That discards records without a rule for choosing the correct one.', 'Pandas has no drop_duplicates method.', 'Duplicates always improve accuracy.', 'Integrity problems require an explicit resolution policy.')]
        },
        {
          slug: 'pivot-melt-stack-and-explode', title: 'pivot, melt, stack, and explode',
          subtitle: 'Change table shape without changing what each value means.',
          concept: 'Wide data spreads a variable across columns; long data stores variable names and values in rows. <code>melt</code> converts wide to long, <code>pivot</code> converts unique long records to wide, and <code>pivot_table</code> aggregates duplicates. <code>stack</code>/<code>unstack</code> move index levels, while <code>explode</code> turns list-like cells into rows.',
          pattern: 'Name identifier columns, measured variables, and aggregation rules before reshaping. Afterward, verify that counts or totals reconcile with the original representation.',
          warning: '<code>pivot</code> fails on duplicate index/column pairs because it refuses to guess how to combine them. Using pivot_table requires choosing that aggregation explicitly.',
          code: 'long = wide.melt(id_vars="student", var_name="course", value_name="score")\nwide_again = long.pivot(index="student", columns="course", values="score")\nitems = orders.explode("product_ids")',
          source: 'https://pandas.pydata.org/docs/user_guide/reshaping.html',
          checks: [q('What does melt usually produce?', 'A longer table with variable names and values in columns.', 'A compiled C++ library.', 'Only a scalar mean.', 'melt converts wide columns into long rows.'), q('Why can pivot reject duplicates?', 'More than one value exists for the same output cell.', 'Pivot cannot handle strings.', 'The package is not installed.', 'pivot will not guess an aggregation rule.'), q('What does explode do?', 'Turns each item in a list-like cell into its own row.', 'Deletes list columns.', 'Sorts every table descending.', 'explode expands nested repeated values.')]
        }
      ]
    },
    {
      title: 'Time Series and Data Pipelines',
      synthesis: q('What two properties are required before trusting a rolling or resampled result?', 'A correctly typed, ordered time axis and an explicit window or frequency rule.', 'A random index and global package installation.', 'Only uppercase column names.', 'Time semantics and window boundaries determine the calculation.'),
      lessons: [
        {
          slug: 'datetime-indexes-resampling-and-time-zones', title: 'Datetime Indexes, Resampling, and Time Zones',
          subtitle: 'Treat time as an ordered axis with frequency, gaps, and location—not as decorated text.',
          concept: 'A <code>DatetimeIndex</code> enables time slicing and frequency-aware operations. <code>resample</code> groups observations into calendar bins for aggregation or upsampling. Time-zone-aware timestamps identify actual instants; conversion changes display zone while localization assigns a zone to previously naive values.',
          pattern: 'Parse with a known rule, normalize to UTC at system boundaries, sort the time index, check duplicates, then resample with a stated frequency and closed/label convention.',
          warning: 'Daylight-saving transitions create missing or repeated local times. Naive timestamps cannot distinguish those cases and cannot safely represent cross-zone events.',
          code: 'events["when"] = pd.to_datetime(events["when"], utc=True)\nhourly = events.set_index("when").sort_index().resample("1h")["value"].mean()',
          source: 'https://pandas.pydata.org/docs/user_guide/timeseries.html',
          checks: [q('What does resample do?', 'Groups time-indexed observations into frequency bins.', 'Installs a new package version.', 'Renames every column.', 'Resampling is time-based grouping.'), q('What is the difference between localization and conversion?', 'Localization assigns a zone; conversion changes an already aware timestamp’s zone.', 'They are identical.', 'Conversion removes all dates.', 'The operations answer different time-zone questions.'), q('Why sort a time index?', 'Time slicing, rolling, and sequence logic require a reliable order.', 'Sorting installs UTC.', 'Indexes cannot store unsorted values.', 'Chronological algorithms depend on order.')]
        },
        {
          slug: 'rolling-expanding-and-window-analysis', title: 'Rolling, Expanding, and Window Analysis',
          subtitle: 'Compute local context without writing nested loops.',
          concept: '<code>rolling</code> calculates over a moving fixed-size or time-based window; <code>expanding</code> uses all observations from the start; exponentially weighted windows decay older influence. Parameters such as window, minimum periods, center, and closed boundaries define which rows participate.',
          pattern: 'Sort first, choose row-count versus time-duration windows deliberately, set <code>min_periods</code>, and compare a few windows by hand before scaling the calculation.',
          warning: 'A rolling result naturally begins with missing values when a full window is required. Filling those values without explanation changes the definition of the statistic.',
          code: 'ordered = frame.sort_values("when")\nordered["mean_3"] = ordered["value"].rolling(window=3, min_periods=2).mean()\nordered["running_max"] = ordered["value"].expanding().max()',
          source: 'https://pandas.pydata.org/docs/user_guide/window.html',
          checks: [q('How does expanding differ from rolling?', 'Expanding begins at the first row and grows; rolling keeps a moving window.', 'Expanding sorts text only.', 'Rolling installs NumPy.', 'Their included-history rules differ.'), q('What does min_periods control?', 'The minimum observations required to produce a result.', 'The package version range.', 'The number of columns.', 'Window outputs may be valid before a full window exists.'), q('Why verify windows manually?', 'Boundary choices can include different rows while code still runs.', 'Pandas cannot test windows.', 'Manual work makes code faster.', 'Small hand checks reveal off-by-one window definitions.')]
        },
        {
          slug: 'method-chaining-pipelines-and-case-studies', title: 'Method Chaining, Pipelines, and Case Studies',
          subtitle: 'Turn exploration into a repeatable input-to-report transformation.',
          concept: 'A data pipeline has explicit stages: ingest, validate, clean, transform, combine, summarize, and publish. Method chaining keeps the flow visible, <code>assign</code> creates columns, <code>pipe</code> applies named functions, and assertions establish contracts between stages. Expert case studies combine all prior topic families.',
          pattern: 'Make each stage accept and return a DataFrame, avoid hidden global state, name domain rules, preserve raw inputs, and test stage boundaries with small fixtures. Materialize intermediate output only where inspection or performance justifies it.',
          warning: 'One enormous chain can be as unreadable as one enormous function. Break at meaningful contracts—not arbitrary line counts—and log row counts plus rejected records.',
          code: 'report = (raw\n    .pipe(validate_schema)\n    .pipe(clean_records)\n    .merge(reference, on="id", validate="many_to_one")\n    .groupby("category", as_index=False)\n    .agg(total=("value", "sum")))',
          source: 'https://pandas.pydata.org/docs/user_guide/',
          checks: [q('What should a pipeline stage expose?', 'A clear input/output contract and validation rule.', 'Hidden global state.', 'An undeclared package version.', 'Stage contracts make the flow testable and composable.'), q('What does pipe support?', 'Applying a named transformation function inside a chain.', 'Compiling Java bytecode.', 'Linking C++ binaries.', 'pipe keeps custom transformations in the visible flow.'), q('When should a long chain be split?', 'At meaningful domain or validation boundaries.', 'After every method call.', 'Never.', 'Named stages improve diagnosis without hiding the pipeline.')]
        }
      ]
    },
    {
      title: 'Package Engineering and Capstone',
      synthesis: q('What proves a package-based program is ready to share?', 'Reproducible dependencies, tests at boundaries, documented assumptions, and validated outputs.', 'It runs once on the author’s computer.', 'It uses the largest possible dependency graph.', 'Operational quality comes from repeatability and evidence.'),
      lessons: [
        {
          slug: 'choosing-packages-security-and-licensing', title: 'Choosing Packages: Security, Maintenance, and Licensing',
          subtitle: 'Every dependency saves code and adds a long-term relationship.',
          concept: 'Evaluate whether the standard library already solves the task, then inspect package maintenance, release history, documentation, issue health, license, dependency graph, and security advisories. Direct dependencies can execute during build or installation and pull transitive code you never selected individually.',
          pattern: 'Define the capability needed, compare the smallest viable options, test one behind a narrow interface, pin the selected version, and record why it was chosen. Remove dependencies that no longer earn their cost.',
          warning: 'Popularity is not a security review. A package name similar to a trusted project can be typosquatting, and an abandoned package may never receive a fix.',
          code: '# Decision record\n# Need: labeled table joins and group summaries\n# Chosen: pandas\n# Version: pinned by project lock/requirements\n# Boundary: analytics.py',
          source: 'https://packaging.python.org/en/latest/guides/tool-recommendations/',
          checks: [q('What is the first package-selection question?', 'Can the language or existing code already solve the need adequately?', 'Which package has the longest name?', 'Which package adds the most dependencies?', 'Avoiding an unnecessary dependency removes all of its future risk.'), q('Why inspect transitive dependencies?', 'They become part of the code and risk shipped with the project.', 'They change variable scope.', 'They cannot affect builds.', 'Indirect dependencies still execute and require updates.'), q('What does a package license govern?', 'How the software may be used, modified, and distributed.', 'Only its runtime speed.', 'The shape of a DataFrame.', 'Licensing is a project constraint, not decoration.')]
        },
        {
          slug: 'testing-debugging-performance-and-reproducibility', title: 'Testing, Debugging, Performance, and Reproducibility',
          subtitle: 'Test your assumptions at the boundary where your code meets package behavior.',
          concept: 'Package-based tests should cover normal, empty, malformed, and boundary data; expected schema and values; mutation; and version-sensitive behavior. Debug from the smallest failing stage, inspect types and labels, and measure before optimizing. Vectorization often reduces Python overhead, but algorithm, memory, and data copies still matter.',
          pattern: 'Create tiny fixtures, assert structure before exact values, use deterministic seeds where randomness exists, record package versions, and profile the real workload. A regression test should remain after every package-related bug fix.',
          warning: 'A notebook cell that once produced the right chart is not a reproducible test. Hidden execution order, modified global state, and unrecorded versions make the result impossible to reconstruct.',
          code: 'def test_course_summary():\n    frame = pd.DataFrame({"course": ["A", "A"], "score": [80, 100]})\n    result = summarize(frame)\n    assert result.to_dict("records") == [{"course": "A", "average": 90.0}]',
          source: 'https://pandas.pydata.org/docs/user_guide/enhancingperf.html',
          checks: [q('Which fixture set is strongest?', 'Normal, empty, malformed, and boundary inputs.', 'Only the largest production file.', 'Only a successful example.', 'Edge fixtures expose assumptions efficiently.'), q('What should happen before optimizing?', 'Measure the real bottleneck.', 'Rewrite everything in C++.', 'Remove all tests.', 'Profiling prevents optimizing irrelevant code.'), q('Why record package versions with test results?', 'Behavior may differ across dependency versions.', 'Versions replace assertions.', 'It makes code compile faster.', 'Version context is part of reproducing a failure.')]
        },
        {
          slug: 'capstone-package-powered-analysis', title: 'Capstone: Package-Powered Analysis',
          subtitle: 'Build one defensible pipeline, then prove it with sandbox practice and a guided project.',
          concept: 'The capstone combines the whole course: define a question, specify schema, clean data, perform labeled transformations, join reference data, aggregate, reshape or analyze time, validate totals, and publish a concise report. The package is a tool; the deliverable is a trustworthy chain of reasoning from raw input to checked output.',
          pattern: 'Choose a small dataset with at least one missing-value rule, one join, one grouped summary, and one date or reshape operation. Write tests before presentation. Complete representative Pandas problems, then apply general programming concepts in one guided sandbox project.',
          warning: 'A polished chart cannot rescue an undocumented filter, an accidental many-to-many join, or an unreproducible environment. Evidence belongs beside the result.',
          code: 'clean = raw.pipe(validate).pipe(transform)\nreport = clean.merge(reference, validate="many_to_one").groupby("category").agg(total=("value", "sum"))\nassert report["total"].sum() == clean["value"].sum()',
          source: 'https://pandas.pydata.org/Pandas_Cheat_Sheet.pdf',
          checks: [q('What makes the capstone trustworthy?', 'Validated inputs, explicit transformations, reconciled outputs, tests, and reproducible dependencies.', 'The number of colors in the chart.', 'Using every pandas method.', 'Trust follows evidence through the entire pipeline.'), q('Why reconcile totals after a join?', 'To detect dropped or multiplied records.', 'To install the join package.', 'To convert timestamps.', 'Totals reveal relationship mistakes.'), q('Where should course concepts be practiced?', 'Pandas Package Mastery and a guided programming project.', 'Only by rereading definitions.', 'Only in an untested notebook.', 'The live sandboxes turn package and language concepts into checked work.')]
        }
      ]
    }
  ];

  const allLessons = units.flatMap((unit, unitIndex) => unit.lessons.map((lesson) => ({ ...lesson, unit: unitIndex + 1, unitTitle: unit.title })));
  allLessons.forEach((lesson, index) => { lesson.number = index + 1; });
  if (typeof module === 'object' && module.exports) module.exports = { course: COURSE, units, lessons: allLessons };
  if (typeof document === 'undefined') return;
  const params = new URLSearchParams(location.search);
  const rotate = (items, amount) => items.slice(amount).concat(items.slice(0, amount));
  const choiceMarkup = (question, index, testItem) => {
    const choices = rotate([question.correct, ...question.wrong], index % 3);
    return `<div class="quiz" ${testItem ? 'data-test-item' : 'data-quiz'} data-topic="${question.prompt.replace(/"/g, '&quot;')}"><p class="quiz-prompt">${question.prompt}</p><div class="quiz-choices">${choices.map((choice) => `<button class="quiz-choice" data-correct="${choice === question.correct}">${choice}</button>`).join('')}</div><p class="quiz-feedback" hidden></p><p class="quiz-explain" hidden>${question.explain}</p></div>`;
  };
  const practiceFor = (unit) => unit === 2 ? '<a href="../python-sandbox.html">Python</a>, <a href="../java-sandbox.html">Java</a>, <a href="../javascript-sandbox.html">JavaScript</a>, and <a href="../cpp-sandbox.html">C++</a> sandboxes' : unit >= 3 && unit <= 7 ? '<a href="../pandas-sandbox.html">Pandas Package Mastery</a>' : unit === 8 ? '<a href="../pandas-sandbox.html">Pandas Package Mastery</a> and <a href="../python-projects.html">Guided Projects</a>' : '<a href="../sandbox.html">Code Sandbox</a>';

  const indexRoot = document.querySelector('[data-course-index]');
  if (indexRoot) {
    units.forEach((unit, unitIndex) => {
      const details = document.createElement('details'); details.className = 'unit-toc';
      details.innerHTML = `<summary>Unit ${unitIndex + 1} — ${unit.title}</summary><div class="toc-list">${unit.lessons.map((lesson) => { const record = allLessons.find((item) => item.slug === lesson.slug); return `<a class="toc-item" href="lesson.html?id=${lesson.slug}"><span class="toc-num">Lesson ${record.number}</span><p class="toc-title">${lesson.title}</p><p class="toc-sub">${lesson.subtitle}</p></a>`; }).join('')}<a class="toc-item" href="unit-test.html?unit=${unitIndex + 1}&version=A"><span class="toc-num">Unit Test</span><p class="toc-title">Unit ${unitIndex + 1} Test</p><p class="toc-sub">10 questions in two versions. Score 90% or higher to clear the unit.</p></a></div>`;
      indexRoot.appendChild(details);
    });
  }

  const lessonRoot = document.querySelector('[data-course-lesson]');
  if (lessonRoot) {
    const lesson = allLessons.find((item) => item.slug === params.get('id')) || allLessons[0];
    const index = allLessons.indexOf(lesson), previous = allLessons[index - 1], next = allLessons[index + 1];
    document.title = `Lesson ${lesson.number}: ${lesson.title} — STEM+`;
    lessonRoot.innerHTML = `<span class="kicker">STEM+ · ${COURSE} · Unit ${lesson.unit} · Lesson ${lesson.number}</span><h1>${lesson.title}</h1><p class="subtitle">${lesson.subtitle}</p><p class="nav-links">${previous ? `<a href="lesson.html?id=${previous.slug}" class="nav-toc">← Lesson ${previous.number}</a>` : ''} <a href="index.html" class="nav-toc">Contents</a> ${next ? `<a href="lesson.html?id=${next.slug}" class="nav-next">Lesson ${next.number} →</a>` : '<a href="course-exam.html" class="nav-next">Course Exam →</a>'} <a href="reference/glossary.html" class="nav-glossary">Glossary →</a></p><h2>Core idea</h2><p>${lesson.concept}</p><div class="box example"><span class="box-label">Working pattern</span><p>${lesson.pattern}</p><pre class="code-block"><code>${lesson.code.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre></div><div class="box why"><span class="box-label">Common failure</span><p>${lesson.warning}</p></div><h2>Practice the concept</h2><p>Use ${practiceFor(lesson.unit)} to turn this lesson into checked code.</p><h2>Check your recall</h2>${lesson.checks.map((question, questionIndex) => choiceMarkup(question, questionIndex, false)).join('')}<h2>Go to the source</h2><p><a href="${lesson.source}">Read the official documentation connected to this lesson.</a></p><p class="ask-teacher">Packages become manageable when every assumption is explicit. If a shape, type, key, version, or dependency rule is unclear, stop and verify it before building further.</p><footer class="lesson-footer">STEM+ · ${COURSE} · Lesson ${lesson.number} of 24</footer>`;
  }

  const testRoot = document.querySelector('[data-course-unit-test]');
  if (testRoot) {
    const unitNumber = Math.min(8, Math.max(1, Number(params.get('unit')) || 1));
    const version = params.get('version') === 'B' ? 'B' : 'A';
    const unit = units[unitNumber - 1];
    let bank = [...unit.lessons.flatMap((lesson) => lesson.checks), unit.synthesis];
    if (version === 'B') bank = rotate([...bank].reverse(), 2);
    bank = bank.slice(0, 10);
    document.title = `Unit ${unitNumber} Test — Version ${version} — ${COURSE} — STEM+`;
    testRoot.innerHTML = `<span class="kicker">STEM+ · ${COURSE} · Unit ${unitNumber} · Unit Test</span><h1>Unit ${unitNumber} Test — Version ${version}</h1><p class="subtitle">${unit.title}. 10 questions; score 90% or higher to clear this unit.</p><p class="nav-links"><a href="index.html" class="nav-toc">← Course Contents</a> <a href="unit-test.html?unit=${unitNumber}&version=${version === 'A' ? 'B' : 'A'}" class="nav-toc">Version ${version === 'A' ? 'B' : 'A'} →</a></p><div data-test data-course="${COURSE}" data-unit="Unit ${unitNumber}" data-kind="unit_test" data-version="${version}">${bank.map((question, index) => choiceMarkup(question, index, true)).join('')}<p class="test-warning" data-test-warning hidden></p><button class="widget-btn" data-test-submit>Submit Test</button><div class="test-result" data-test-result hidden></div></div><footer class="lesson-footer">STEM+ · ${COURSE} · Unit ${unitNumber} Test — Version ${version}</footer>`;
  }

  const examRoot = document.querySelector('[data-course-exam]');
  if (examRoot) {
    const examQuestions = units.flatMap((unit) => [unit.lessons[0].checks[0], unit.lessons[1].checks[1]]).concat(units.slice(0, 4).map((unit) => unit.synthesis));
    examRoot.innerHTML = `<span class="kicker">STEM+ · ${COURSE} · Course Exam</span><h1>${COURSE} — Course Exam</h1><p class="subtitle">20 questions spanning all 8 units. Clear every unit test, then score 90% or higher.</p><p class="nav-links"><a href="index.html" class="nav-toc">← Course Contents</a> <a href="progress-report.html" class="nav-toc">Progress Report →</a></p><div data-exam-gate data-course="${COURSE}" data-required-units="Unit 1|Unit 2|Unit 3|Unit 4|Unit 5|Unit 6|Unit 7|Unit 8"><div class="exam-locked" data-exam-locked hidden></div><div data-test data-course="${COURSE}" data-unit="Course Exam" data-kind="course_exam" hidden>${examQuestions.map((question, index) => choiceMarkup(question, index, true)).join('')}<p class="test-warning" data-test-warning hidden></p><button class="widget-btn" data-test-submit>Submit Exam</button><div class="test-result" data-test-result hidden></div></div></div><footer class="lesson-footer">STEM+ · ${COURSE} · Course Exam</footer>`;
  }

  const glossaryRoot = document.querySelector('[data-course-glossary]');
  if (glossaryRoot) {
    const terms = [
      ['API', 'The public interface and behavior callers may rely on.'], ['Dependency', 'External software required by a project.'], ['Manifest', 'A file declaring project metadata and direct dependencies.'], ['Lockfile', 'A record of exact resolved dependency versions.'], ['Virtual environment', 'An isolated package installation context.'], ['Transitive dependency', 'A package required indirectly through another dependency.'], ['Namespace', 'A context mapping names to objects.'], ['Series', 'A one-dimensional labeled pandas array.'], ['DataFrame', 'A two-dimensional labeled pandas table.'], ['Index', 'The labels identifying Series or DataFrame rows.'], ['Boolean mask', 'Aligned True/False values used for selection.'], ['Missing value', 'A marker for unavailable or undefined data.'], ['Aggregation', 'A calculation reducing many values to a summary.'], ['GroupBy', 'Split-apply-combine operations organized by keys.'], ['transform', 'A group operation returning output aligned to original rows.'], ['Cardinality', 'The one-to-one, one-to-many, or many-to-many relationship between keys.'], ['Primary key', 'A field or field set uniquely identifying a record.'], ['Anti-join', 'A selection of records with no match in another table.'], ['melt', 'A reshape from wide columns to long variable/value rows.'], ['pivot', 'A reshape from unique long records to a wide table.'], ['DatetimeIndex', 'An index whose labels have datetime semantics.'], ['Resampling', 'Grouping time-indexed observations into frequency bins.'], ['Rolling window', 'A calculation over a moving local subset.'], ['Pipeline', 'A sequence of explicit input-to-output transformation stages.'], ['Vectorization', 'Applying operations across arrays without explicit Python-level loops.'], ['Reproducibility', 'The ability to rebuild the same environment and result from recorded inputs and versions.']
    ];
    glossaryRoot.innerHTML = terms.map(([term, definition]) => `<div class="box"><span class="box-label">${term}</span><p>${definition}</p></div>`).join('');
  }
}());
