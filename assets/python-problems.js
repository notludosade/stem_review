(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.STEMPythonProblems = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const make = (id, topic, title, signature, prompt, tests, reference, hint) => ({
    id,
    topic,
    title,
    functionName: signature.slice(0, signature.indexOf('(')),
    prompt,
    tests,
    reference,
    hint,
    starter: `def ${signature}:\n    # Write your solution here\n    pass`
  });

  const problems = [
    make('py-001', 'Basics', 'Add Two Numbers', 'add_numbers(a, b)', 'Return the sum of a and b.', [
      { args: [2, 3], expected: 5 }, { args: [-4, 9], expected: 5 }, { args: [0, 0], expected: 0 }, { args: [1.5, 2.25], expected: 3.75 }
    ], 'def add_numbers(a, b):\n    return a + b', 'Use the + operator.'),
    make('py-002', 'Basics', 'Rectangle Area', 'rectangle_area(width, height)', 'Return the area of a rectangle.', [
      { args: [4, 6], expected: 24 }, { args: [2.5, 4], expected: 10 }, { args: [0, 8], expected: 0 }, { args: [11, 3], expected: 33 }
    ], 'def rectangle_area(width, height):\n    return width * height', 'Area equals width times height.'),
    make('py-003', 'Basics', 'Celsius to Fahrenheit', 'celsius_to_fahrenheit(celsius)', 'Convert Celsius to Fahrenheit using F = C × 9/5 + 32.', [
      { args: [0], expected: 32 }, { args: [100], expected: 212 }, { args: [-40], expected: -40 }, { args: [20], expected: 68 }
    ], 'def celsius_to_fahrenheit(celsius):\n    return celsius * 9 / 5 + 32', 'Apply multiplication before adding 32.'),
    make('py-004', 'Basics', 'Minutes to Seconds', 'minutes_to_seconds(minutes)', 'Return the number of seconds in the given minutes.', [
      { args: [1], expected: 60 }, { args: [5], expected: 300 }, { args: [0], expected: 0 }, { args: [2.5], expected: 150 }
    ], 'def minutes_to_seconds(minutes):\n    return minutes * 60', 'One minute contains 60 seconds.'),
    make('py-005', 'Basics', 'Division Remainder', 'remainder(a, b)', 'Return the remainder when integer a is divided by nonzero integer b.', [
      { args: [17, 5], expected: 2 }, { args: [20, 4], expected: 0 }, { args: [9, 2], expected: 1 }, { args: [3, 8], expected: 3 }
    ], 'def remainder(a, b):\n    return a % b', 'Python uses % for remainder.'),
    make('py-006', 'Basics', 'Average of Three', 'average_three(a, b, c)', 'Return the arithmetic mean of three numbers.', [
      { args: [3, 6, 9], expected: 6 }, { args: [1, 2, 3], expected: 2 }, { args: [-3, 0, 3], expected: 0 }, { args: [2.5, 3.5, 6], expected: 4 }
    ], 'def average_three(a, b, c):\n    return (a + b + c) / 3', 'Add first, then divide by 3.'),
    make('py-007', 'Basics', 'Absolute Difference', 'absolute_difference(a, b)', 'Return the nonnegative distance between a and b.', [
      { args: [10, 4], expected: 6 }, { args: [4, 10], expected: 6 }, { args: [-3, 5], expected: 8 }, { args: [7, 7], expected: 0 }
    ], 'def absolute_difference(a, b):\n    return abs(a - b)', 'abs() makes a number nonnegative.'),
    make('py-008', 'Basics', 'Triangle Area', 'triangle_area(base, height)', 'Return a triangle’s area from its base and perpendicular height.', [
      { args: [10, 4], expected: 20 }, { args: [3, 7], expected: 10.5 }, { args: [0, 5], expected: 0 }, { args: [8, 2.5], expected: 10 }
    ], 'def triangle_area(base, height):\n    return base * height / 2', 'A triangle is half the matching rectangle.'),
    make('py-009', 'Basics', 'Purchase Total', 'purchase_total(price, quantity)', 'Return price multiplied by quantity.', [
      { args: [4.5, 3], expected: 13.5 }, { args: [10, 0], expected: 0 }, { args: [2.25, 4], expected: 9 }, { args: [1.2, 5], expected: 6 }
    ], 'def purchase_total(price, quantity):\n    return price * quantity', 'Multiply unit price by item count.'),
    make('py-010', 'Basics', 'Last Digit', 'last_digit(n)', 'Return the last digit of a nonnegative integer.', [
      { args: [1234], expected: 4 }, { args: [80], expected: 0 }, { args: [7], expected: 7 }, { args: [99999], expected: 9 }
    ], 'def last_digit(n):\n    return n % 10', 'The remainder after division by 10 is the last digit.'),

    make('py-011', 'Conditionals', 'Even or Odd', 'is_even(n)', 'Return True when n is even; otherwise return False.', [
      { args: [8], expected: true }, { args: [7], expected: false }, { args: [0], expected: true }, { args: [-3], expected: false }
    ], 'def is_even(n):\n    return n % 2 == 0', 'Even integers have remainder 0 after division by 2.'),
    make('py-012', 'Conditionals', 'Larger Number', 'max_of_two(a, b)', 'Return the larger of a and b. Return either value when equal.', [
      { args: [3, 9], expected: 9 }, { args: [12, 4], expected: 12 }, { args: [-2, -7], expected: -2 }, { args: [5, 5], expected: 5 }
    ], 'def max_of_two(a, b):\n    if a >= b:\n        return a\n    return b', 'Compare the two values with if.'),
    make('py-013', 'Conditionals', 'Letter Grade', 'letter_grade(score)', 'Return A for 90+, B for 80–89, C for 70–79, D for 60–69, and F below 60.', [
      { args: [95], expected: 'A' }, { args: [80], expected: 'B' }, { args: [72], expected: 'C' }, { args: [59], expected: 'F' }, { args: [60], expected: 'D' }
    ], "def letter_grade(score):\n    if score >= 90: return 'A'\n    if score >= 80: return 'B'\n    if score >= 70: return 'C'\n    if score >= 60: return 'D'\n    return 'F'", 'Check thresholds from highest to lowest.'),
    make('py-014', 'Conditionals', 'Leap Year', 'is_leap_year(year)', 'Return True when year is a Gregorian leap year. A leap year is divisible by 4, except century years must be divisible by 400.', [
      { args: [2024], expected: true }, { args: [1900], expected: false }, { args: [2000], expected: true }, { args: [2023], expected: false }
    ], 'def is_leap_year(year):\n    return year % 400 == 0 or (year % 4 == 0 and year % 100 != 0)', 'Handle divisibility by 400 before the century exception.'),
    make('py-015', 'Conditionals', 'Number Sign', 'sign_label(n)', 'Return "positive", "negative", or "zero".', [
      { args: [4], expected: 'positive' }, { args: [-0.5], expected: 'negative' }, { args: [0], expected: 'zero' }, { args: [-12], expected: 'negative' }
    ], "def sign_label(n):\n    if n > 0: return 'positive'\n    if n < 0: return 'negative'\n    return 'zero'", 'Use separate comparisons for above and below zero.'),
    make('py-016', 'Conditionals', 'Voting Age', 'can_vote(age)', 'Return True when age is at least 18.', [
      { args: [18], expected: true }, { args: [17], expected: false }, { args: [70], expected: true }, { args: [0], expected: false }
    ], 'def can_vote(age):\n    return age >= 18', 'At least means greater than or equal to.'),
    make('py-017', 'Conditionals', 'Shipping Cost', 'shipping_cost(order_total)', 'Return 0 for orders of at least $50; otherwise return 5.99.', [
      { args: [50], expected: 0 }, { args: [49.99], expected: 5.99 }, { args: [100], expected: 0 }, { args: [0], expected: 5.99 }
    ], 'def shipping_cost(order_total):\n    if order_total >= 50:\n        return 0\n    return 5.99', 'The boundary value 50 receives free shipping.'),
    make('py-018', 'Conditionals', 'Clamp a Value', 'clamp(value, low, high)', 'Keep value inside the inclusive range low to high. Return low when below it, high when above it, otherwise value.', [
      { args: [5, 0, 10], expected: 5 }, { args: [-3, 0, 10], expected: 0 }, { args: [14, 0, 10], expected: 10 }, { args: [7, 7, 9], expected: 7 }
    ], 'def clamp(value, low, high):\n    if value < low: return low\n    if value > high: return high\n    return value', 'Check both boundaries before returning the original value.'),
    make('py-019', 'Conditionals', 'Admission Price', 'ticket_price(age)', 'Return 0 for ages under 5, 8 for ages 5–12, 7 for ages 65+, and 12 otherwise.', [
      { args: [4], expected: 0 }, { args: [8], expected: 8 }, { args: [30], expected: 12 }, { args: [65], expected: 7 }, { args: [12], expected: 8 }
    ], 'def ticket_price(age):\n    if age < 5: return 0\n    if age <= 12: return 8\n    if age >= 65: return 7\n    return 12', 'Check the non-overlapping age groups in order.'),
    make('py-020', 'Conditionals', 'Valid Triangle', 'is_triangle(a, b, c)', 'Return True only when all sides are positive and every pair sums to more than the remaining side.', [
      { args: [3, 4, 5], expected: true }, { args: [1, 2, 3], expected: false }, { args: [5, 5, 8], expected: true }, { args: [0, 4, 4], expected: false }
    ], 'def is_triangle(a, b, c):\n    return a > 0 and b > 0 and c > 0 and a + b > c and a + c > b and b + c > a', 'A valid triangle satisfies three strict triangle inequalities.'),

    make('py-021', 'Loops', 'Sum Through N', 'sum_to_n(n)', 'Return 1 + 2 + … + n for a nonnegative integer n. Use a loop.', [
      { args: [5], expected: 15 }, { args: [1], expected: 1 }, { args: [0], expected: 0 }, { args: [10], expected: 55 }
    ], 'def sum_to_n(n):\n    total = 0\n    for value in range(1, n + 1):\n        total += value\n    return total', 'Accumulate each value into a running total.'),
    make('py-022', 'Loops', 'Factorial', 'factorial(n)', 'Return n! for a nonnegative integer n. Remember that 0! = 1.', [
      { args: [5], expected: 120 }, { args: [0], expected: 1 }, { args: [1], expected: 1 }, { args: [7], expected: 5040 }
    ], 'def factorial(n):\n    result = 1\n    for value in range(2, n + 1):\n        result *= value\n    return result', 'Start at 1 so the zero case works.'),
    make('py-023', 'Loops', 'Count Multiples', 'count_multiples(limit, divisor)', 'Count positive integers from 1 through limit that are divisible by positive divisor.', [
      { args: [10, 3], expected: 3 }, { args: [20, 5], expected: 4 }, { args: [4, 9], expected: 0 }, { args: [12, 2], expected: 6 }
    ], 'def count_multiples(limit, divisor):\n    count = 0\n    for value in range(1, limit + 1):\n        if value % divisor == 0:\n            count += 1\n    return count', 'Test each candidate with the remainder operator.'),
    make('py-024', 'Loops', 'Sum Even Values', 'sum_even(values)', 'Return the sum of every even integer in values.', [
      { args: [[1, 2, 3, 4]], expected: 6 }, { args: [[2, 2, 2]], expected: 6 }, { args: [[1, 3, 5]], expected: 0 }, { args: [[-4, -1, 6]], expected: 2 }
    ], 'def sum_even(values):\n    total = 0\n    for value in values:\n        if value % 2 == 0:\n            total += value\n    return total', 'Only add values with remainder 0 after division by 2.'),
    make('py-025', 'Loops', 'Count Digits', 'count_digits(n)', 'Return the number of decimal digits in an integer. Ignore a negative sign; zero has one digit.', [
      { args: [4821], expected: 4 }, { args: [0], expected: 1 }, { args: [-93], expected: 2 }, { args: [7], expected: 1 }
    ], 'def count_digits(n):\n    n = abs(n)\n    if n == 0: return 1\n    count = 0\n    while n > 0:\n        count += 1\n        n //= 10\n    return count', 'Repeated integer division by 10 removes one digit.'),
    make('py-026', 'Loops', 'Reverse an Integer', 'reverse_number(n)', 'Reverse the digits of a nonnegative integer. Leading zeroes in the reversed form disappear.', [
      { args: [1234], expected: 4321 }, { args: [1200], expected: 21 }, { args: [7], expected: 7 }, { args: [9008], expected: 8009 }
    ], 'def reverse_number(n):\n    result = 0\n    while n > 0:\n        result = result * 10 + n % 10\n        n //= 10\n    return result', 'Take the last digit with % 10, then remove it with // 10.'),
    make('py-027', 'Loops', 'Multiplication Table', 'multiplication_table(n)', 'Return a list containing n × 1 through n × 10.', [
      { args: [3], expected: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] }, { args: [1], expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }, { args: [0], expected: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }, { args: [-2], expected: [-2, -4, -6, -8, -10, -12, -14, -16, -18, -20] }
    ], 'def multiplication_table(n):\n    result = []\n    for value in range(1, 11):\n        result.append(n * value)\n    return result', 'Append one product for each multiplier from 1 through 10.'),
    make('py-028', 'Loops', 'FizzBuzz Value', 'fizzbuzz_value(n)', 'Return "FizzBuzz" when n is divisible by 3 and 5, "Fizz" for only 3, "Buzz" for only 5, otherwise return str(n).', [
      { args: [15], expected: 'FizzBuzz' }, { args: [9], expected: 'Fizz' }, { args: [10], expected: 'Buzz' }, { args: [7], expected: '7' }
    ], "def fizzbuzz_value(n):\n    if n % 15 == 0: return 'FizzBuzz'\n    if n % 3 == 0: return 'Fizz'\n    if n % 5 == 0: return 'Buzz'\n    return str(n)", 'Check divisibility by both numbers first.'),
    make('py-029', 'Loops', 'Integer Power', 'integer_power(base, exponent)', 'Return base raised to a nonnegative integer exponent using repeated multiplication.', [
      { args: [2, 5], expected: 32 }, { args: [7, 0], expected: 1 }, { args: [-3, 3], expected: -27 }, { args: [4, 2], expected: 16 }
    ], 'def integer_power(base, exponent):\n    result = 1\n    for _ in range(exponent):\n        result *= base\n    return result', 'Multiply result by base once per exponent step.'),
    make('py-030', 'Loops', 'Greatest Common Divisor', 'greatest_common_divisor(a, b)', 'Return the greatest common divisor of two nonnegative integers using the Euclidean algorithm.', [
      { args: [48, 18], expected: 6 }, { args: [7, 5], expected: 1 }, { args: [20, 0], expected: 20 }, { args: [54, 24], expected: 6 }
    ], 'def greatest_common_divisor(a, b):\n    while b != 0:\n        a, b = b, a % b\n    return a', 'Replace (a, b) with (b, a % b) until b is zero.'),

    make('py-031', 'Strings', 'Friendly Greeting', 'greet(name)', 'Return exactly "Hello, NAME!" using the supplied name.', [
      { args: ['Ada'], expected: 'Hello, Ada!' }, { args: ['Sam'], expected: 'Hello, Sam!' }, { args: ['STEM+'], expected: 'Hello, STEM+!' }, { args: [''], expected: 'Hello, !' }
    ], "def greet(name):\n    return 'Hello, ' + name + '!'", 'Concatenate fixed text with name.'),
    make('py-032', 'Strings', 'Count Vowels', 'count_vowels(text)', 'Count a, e, i, o, and u without caring about letter case.', [
      { args: ['education'], expected: 5 }, { args: ['RHYTHM'], expected: 0 }, { args: ['OpenAI'], expected: 4 }, { args: ['A quick test'], expected: 4 }
    ], "def count_vowels(text):\n    count = 0\n    for char in text.lower():\n        if char in 'aeiou':\n            count += 1\n    return count", 'Lowercase each character before checking membership.'),
    make('py-033', 'Strings', 'Reverse Text', 'reverse_text(text)', 'Return text with its characters in reverse order.', [
      { args: ['python'], expected: 'nohtyp' }, { args: ['abc 123'], expected: '321 cba' }, { args: [''], expected: '' }, { args: ['A'], expected: 'A' }
    ], 'def reverse_text(text):\n    return text[::-1]', 'A slice with step -1 walks backward.'),
    make('py-034', 'Strings', 'Phrase Palindrome', 'is_palindrome(text)', 'Return True when text reads the same backward after removing spaces and ignoring case.', [
      { args: ['Never odd or even'], expected: true }, { args: ['Python'], expected: false }, { args: ['Race car'], expected: true }, { args: [''], expected: true }
    ], "def is_palindrome(text):\n    cleaned = text.replace(' ', '').lower()\n    return cleaned == cleaned[::-1]", 'Create a cleaned string, then compare it with its reverse.'),
    make('py-035', 'Strings', 'Word Count', 'word_count(text)', 'Return the number of whitespace-separated words. Repeated spaces should not create empty words.', [
      { args: ['one two three'], expected: 3 }, { args: ['  spaced   out '], expected: 2 }, { args: [''], expected: 0 }, { args: ['single'], expected: 1 }
    ], 'def word_count(text):\n    return len(text.split())', 'split() without an argument handles repeated whitespace.'),
    make('py-036', 'Strings', 'Initials', 'initials(full_name)', 'Return uppercase first letters of each whitespace-separated name with no punctuation between them.', [
      { args: ['Ada Lovelace'], expected: 'AL' }, { args: ['grace brewster murray hopper'], expected: 'GBMH' }, { args: ['  Alan   Turing '], expected: 'AT' }, { args: ['Prince'], expected: 'P' }
    ], "def initials(full_name):\n    result = ''\n    for word in full_name.split():\n        result += word[0].upper()\n    return result", 'Split into words and take index 0 from each.'),
    make('py-037', 'Strings', 'Longest Word', 'longest_word(words)', 'Return the longest string in a nonempty list. Keep the first word when lengths tie.', [
      { args: [['cat', 'elephant', 'dog']], expected: 'elephant' }, { args: [['red', 'blue', 'gold']], expected: 'blue' }, { args: [['single']], expected: 'single' }, { args: [['aa', 'bbb', 'cc']], expected: 'bbb' }
    ], 'def longest_word(words):\n    longest = words[0]\n    for word in words[1:]:\n        if len(word) > len(longest):\n            longest = word\n    return longest', 'Update only for a strictly longer word to preserve the first tie.'),
    make('py-038', 'Strings', 'Count a Character', 'count_character(text, target)', 'Count exact occurrences of the one-character target. Matching is case-sensitive.', [
      { args: ['banana', 'a'], expected: 3 }, { args: ['Mississippi', 's'], expected: 4 }, { args: ['AaA', 'a'], expected: 1 }, { args: ['', 'x'], expected: 0 }
    ], 'def count_character(text, target):\n    count = 0\n    for char in text:\n        if char == target:\n            count += 1\n    return count', 'Compare each character directly with target.'),
    make('py-039', 'Strings', 'Remove Vowels', 'remove_vowels(text)', 'Return text with a, e, i, o, and u removed in either case. Preserve every other character.', [
      { args: ['Hello World'], expected: 'Hll Wrld' }, { args: ['AEIOU'], expected: '' }, { args: ['rhythm'], expected: 'rhythm' }, { args: ['Data 123'], expected: 'Dt 123' }
    ], "def remove_vowels(text):\n    result = ''\n    for char in text:\n        if char.lower() not in 'aeiou':\n            result += char\n    return result", 'Append characters only when they are not vowels.'),
    make('py-040', 'Strings', 'Title Words', 'title_words(text)', 'Return the text with the first letter of each whitespace-separated word uppercase and remaining letters lowercase. Join words with one space.', [
      { args: ['hello world'], expected: 'Hello World' }, { args: ['pYTHON is FUN'], expected: 'Python Is Fun' }, { args: ['  extra   spaces '], expected: 'Extra Spaces' }, { args: [''], expected: '' }
    ], "def title_words(text):\n    words = []\n    for word in text.split():\n        words.append(word[0].upper() + word[1:].lower())\n    return ' '.join(words)", 'Normalize each word, then join the result list.'),

    make('py-041', 'Collections', 'First and Last', 'first_and_last(values)', 'Return a two-item list containing the first and last elements of a nonempty list.', [
      { args: [[3, 5, 7, 9]], expected: [3, 9] }, { args: [['a']], expected: ['a', 'a'] }, { args: [[true, false]], expected: [true, false] }, { args: [[0, -1, -2]], expected: [0, -2] }
    ], 'def first_and_last(values):\n    return [values[0], values[-1]]', 'Python index -1 means the final element.'),
    make('py-042', 'Collections', 'Unique in Original Order', 'unique_values(values)', 'Return a list with duplicates removed while preserving first appearance order.', [
      { args: [[1, 2, 1, 3, 2]], expected: [1, 2, 3] }, { args: [['a', 'a', 'b']], expected: ['a', 'b'] }, { args: [[]], expected: [] }, { args: [[4, 4, 4]], expected: [4] }
    ], 'def unique_values(values):\n    result = []\n    for value in values:\n        if value not in result:\n            result.append(value)\n    return result', 'Append only values not already in the result.'),
    make('py-043', 'Collections', 'Second-Largest Distinct Value', 'second_largest(values)', 'Return the second-largest distinct number. At least two distinct values are guaranteed.', [
      { args: [[4, 1, 9, 7]], expected: 7 }, { args: [[5, 5, 3, 2]], expected: 3 }, { args: [[-1, -5, -3]], expected: -3 }, { args: [[10, 8, 10, 9]], expected: 9 }
    ], 'def second_largest(values):\n    distinct = []\n    for value in values:\n        if value not in distinct:\n            distinct.append(value)\n    distinct.sort(reverse=True)\n    return distinct[1]', 'Remove duplicates, sort descending, then use index 1.'),
    make('py-044', 'Collections', 'Rotate Left', 'rotate_left(values, steps)', 'Rotate a nonempty list left by steps positions. steps may be larger than the list length.', [
      { args: [[1, 2, 3, 4], 1], expected: [2, 3, 4, 1] }, { args: [[1, 2, 3], 5], expected: [3, 1, 2] }, { args: [['a'], 7], expected: ['a'] }, { args: [[0, 1, 2, 3], 0], expected: [0, 1, 2, 3] }
    ], 'def rotate_left(values, steps):\n    steps %= len(values)\n    return values[steps:] + values[:steps]', 'Reduce steps with modulo before slicing.'),
    make('py-045', 'Collections', 'Frequency Map', 'frequency_map(values)', 'Return a dictionary counting each string in values.', [
      { args: [['a', 'b', 'a']], expected: { a: 2, b: 1 } }, { args: [['red', 'red', 'red']], expected: { red: 3 } }, { args: [[]], expected: {} }, { args: [['x', 'y', 'z', 'x']], expected: { x: 2, y: 1, z: 1 } }
    ], 'def frequency_map(values):\n    counts = {}\n    for value in values:\n        counts[value] = counts.get(value, 0) + 1\n    return counts', 'Dictionary get can supply zero for a new key.'),
    make('py-046', 'Collections', 'Merge Totals', 'merge_totals(left, right)', 'Merge two string-to-number dictionaries. Add values when a key appears in both.', [
      { args: [{ a: 2, b: 3 }, { b: 4, c: 5 }], expected: { a: 2, b: 7, c: 5 } }, { args: [{}, { x: 1 }], expected: { x: 1 } }, { args: [{ p: -2 }, { p: 5 }], expected: { p: 3 } }, { args: [{ a: 1 }, {}], expected: { a: 1 } }
    ], 'def merge_totals(left, right):\n    result = dict(left)\n    for key, value in right.items():\n        result[key] = result.get(key, 0) + value\n    return result', 'Copy left, then accumulate values from right.'),
    make('py-047', 'Collections', 'Top Student', 'top_student(scores)', 'scores maps names to numbers. Return the highest-scoring name; break ties alphabetically.', [
      { args: [{ Ana: 91, Bo: 88 }], expected: 'Ana' }, { args: [{ Zoe: 95, Amy: 95 }], expected: 'Amy' }, { args: [{ Kim: 70 }], expected: 'Kim' }, { args: [{ C: -1, B: 0, A: 0 }], expected: 'A' }
    ], 'def top_student(scores):\n    best = None\n    for name in sorted(scores):\n        if best is None or scores[name] > scores[best]:\n            best = name\n    return best', 'Alphabetical iteration makes a strict score update preserve the right tie winner.'),
    make('py-048', 'Collections', 'Flatten One Level', 'flatten_once(rows)', 'Combine a list of lists into one list while preserving order.', [
      { args: [[[1, 2], [3], [4, 5]]], expected: [1, 2, 3, 4, 5] }, { args: [[[], ['a'], []]], expected: ['a'] }, { args: [[]], expected: [] }, { args: [[[true, false], [true]]], expected: [true, false, true] }
    ], 'def flatten_once(rows):\n    result = []\n    for row in rows:\n        result.extend(row)\n    return result', 'extend adds every element from one row.'),
    make('py-049', 'Collections', 'Moving Average', 'moving_average(values, window)', 'Return averages for every consecutive window. Round each average to 3 decimal places. window is valid.', [
      { args: [[1, 2, 3, 4], 2], expected: [1.5, 2.5, 3.5] }, { args: [[3, 6, 9], 3], expected: [6] }, { args: [[1, 2, 2], 2], expected: [1.5, 2] }, { args: [[5, 5], 1], expected: [5, 5] }
    ], 'def moving_average(values, window):\n    result = []\n    for start in range(len(values) - window + 1):\n        chunk = values[start:start + window]\n        result.append(round(sum(chunk) / window, 3))\n    return result', 'Slice each window, sum it, and divide by its fixed length.'),
    make('py-050', 'Collections', 'Group by First Letter', 'group_by_first_letter(words)', 'Return a dictionary grouping words by lowercase first letter. Preserve word order. All words are nonempty.', [
      { args: [['Apple', 'ant', 'Bear']], expected: { a: ['Apple', 'ant'], b: ['Bear'] } }, { args: [['cat', 'car', 'dog']], expected: { c: ['cat', 'car'], d: ['dog'] } }, { args: [[]], expected: {} }, { args: [['Zed', 'alpha']], expected: { z: ['Zed'], a: ['alpha'] } }
    ], 'def group_by_first_letter(words):\n    groups = {}\n    for word in words:\n        key = word[0].lower()\n        if key not in groups:\n            groups[key] = []\n        groups[key].append(word)\n    return groups', 'Create a list the first time each lowercase letter appears.'),

    make('py-051', 'Data Projects', 'Clean Numeric Values', 'clean_numbers(values)', 'Return numeric values as floats. Ignore None, nonnumeric strings, and negative numbers; accept numeric strings.', [
      { args: [[1, '2.5', null, 'bad', -3]], expected: [1, 2.5] }, { args: [['0', 4, '7']], expected: [0, 4, 7] }, { args: [[null, 'x']], expected: [] }, { args: [[3.2, '-1', '5.5']], expected: [3.2, 5.5] }
    ], "def clean_numbers(values):\n    result = []\n    for value in values:\n        try:\n            number = float(value)\n            if number >= 0:\n                result.append(number)\n        except (TypeError, ValueError):\n            pass\n    return result", 'Try float conversion and keep only successful nonnegative results.'),
    make('py-052', 'Data Projects', 'Sales Total', 'sales_total(rows)', 'Each row has price and quantity. Return total revenue rounded to 2 decimals.', [
      { args: [[{ price: 2.5, quantity: 4 }, { price: 1, quantity: 3 }]], expected: 13 }, { args: [[]], expected: 0 }, { args: [[{ price: 9.99, quantity: 2 }]], expected: 19.98 }, { args: [[{ price: 1.25, quantity: 3 }, { price: 2.1, quantity: 2 }]], expected: 7.95 }
    ], "def sales_total(rows):\n    total = 0\n    for row in rows:\n        total += row['price'] * row['quantity']\n    return round(total, 2)", 'Multiply within each row, then add to a running total.'),
    make('py-053', 'Data Projects', 'Average by Category', 'average_by_category(records)', 'Each record has category and value. Return category averages rounded to 3 decimals.', [
      { args: [[{ category: 'A', value: 2 }, { category: 'A', value: 4 }, { category: 'B', value: 9 }]], expected: { A: 3, B: 9 } }, { args: [[]], expected: {} }, { args: [[{ category: 'x', value: 1.5 }, { category: 'x', value: 2.5 }]], expected: { x: 2 } }, { args: [[{ category: 'a', value: -2 }, { category: 'b', value: 2 }, { category: 'a', value: 5 }]], expected: { a: 1.5, b: 2 } }
    ], "def average_by_category(records):\n    totals = {}\n    counts = {}\n    for row in records:\n        key = row['category']\n        totals[key] = totals.get(key, 0) + row['value']\n        counts[key] = counts.get(key, 0) + 1\n    return {key: round(totals[key] / counts[key], 3) for key in totals}", 'Track a total and count for every category.'),
    make('py-054', 'Data Projects', 'Filter Score Rows', 'filter_by_score(rows, minimum)', 'Return rows whose score is at least minimum. Preserve row order and full dictionaries.', [
      { args: [[{ name: 'A', score: 80 }, { name: 'B', score: 60 }], 70], expected: [{ name: 'A', score: 80 }] }, { args: [[{ id: 1, score: 5 }], 5], expected: [{ id: 1, score: 5 }] }, { args: [[], 10], expected: [] }, { args: [[{ score: -1 }, { score: 0 }, { score: 1 }], 0], expected: [{ score: 0 }, { score: 1 }] }
    ], "def filter_by_score(rows, minimum):\n    result = []\n    for row in rows:\n        if row['score'] >= minimum:\n            result.append(row)\n    return result", 'Append only rows meeting the inclusive threshold.'),
    make('py-055', 'Data Projects', 'Normalize Scores', 'normalize_scores(scores)', 'Apply min-max normalization: (x−min)/(max−min), rounded to 3 decimals. Return [] for empty input and all zeroes when every score is equal.', [
      { args: [[10, 20, 30]], expected: [0, 0.5, 1] }, { args: [[5, 5]], expected: [0, 0] }, { args: [[]], expected: [] }, { args: [[-2, 0, 6]], expected: [0, 0.25, 1] }
    ], 'def normalize_scores(scores):\n    if not scores: return []\n    low, high = min(scores), max(scores)\n    if low == high: return [0 for _ in scores]\n    return [round((value - low) / (high - low), 3) for value in scores]', 'Handle empty and equal-value cases before dividing by the range.'),
    make('py-056', 'Data Projects', 'Deduplicate by ID', 'deduplicate_by_id(records)', 'Return only the first record for each id, preserving input order.', [
      { args: [[{ id: 1, value: 'a' }, { id: 1, value: 'b' }, { id: 2, value: 'c' }]], expected: [{ id: 1, value: 'a' }, { id: 2, value: 'c' }] }, { args: [[]], expected: [] }, { args: [[{ id: 'x' }, { id: 'y' }]], expected: [{ id: 'x' }, { id: 'y' }] }, { args: [[{ id: 2 }, { id: 2 }, { id: 2 }]], expected: [{ id: 2 }] }
    ], "def deduplicate_by_id(records):\n    seen = set()\n    result = []\n    for row in records:\n        if row['id'] not in seen:\n            seen.add(row['id'])\n            result.append(row)\n    return result", 'Use a set to remember IDs already kept.'),
    make('py-057', 'Data Projects', 'Transaction Summary', 'transaction_summary(rows)', 'Rows contain type ("income" or "expense") and amount. Return income, expense, and net totals rounded to 2 decimals.', [
      { args: [[{ type: 'income', amount: 100 }, { type: 'expense', amount: 35 }]], expected: { income: 100, expense: 35, net: 65 } }, { args: [[]], expected: { income: 0, expense: 0, net: 0 } }, { args: [[{ type: 'expense', amount: 2.5 }, { type: 'expense', amount: 1.25 }]], expected: { income: 0, expense: 3.75, net: -3.75 } }, { args: [[{ type: 'income', amount: 5.555 }, { type: 'expense', amount: 1.111 }]], expected: { income: 5.55, expense: 1.11, net: 4.44 } }
    ], "def transaction_summary(rows):\n    income = 0\n    expense = 0\n    for row in rows:\n        if row['type'] == 'income': income += row['amount']\n        elif row['type'] == 'expense': expense += row['amount']\n    return {'income': round(income, 2), 'expense': round(expense, 2), 'net': round(income - expense, 2)}", 'Keep separate totals, then subtract expense from income.'),
    make('py-058', 'Data Projects', 'Column Mean', 'column_mean(rows, key)', 'Return the mean for key, ignoring rows where key is absent or None. Round to 3 decimals; return None when no usable values exist.', [
      { args: [[{ x: 2 }, { x: 4 }, { x: null }, {}], 'x'], expected: 3 }, { args: [[], 'score'], expected: null }, { args: [[{ a: 1.5 }, { a: 2.5 }], 'a'], expected: 2 }, { args: [[{ a: null }, { b: 3 }], 'a'], expected: null }
    ], 'def column_mean(rows, key):\n    values = []\n    for row in rows:\n        if key in row and row[key] is not None:\n            values.append(row[key])\n    if not values: return None\n    return round(sum(values) / len(values), 3)', 'Collect valid values first so the empty case is easy to detect.'),
    make('py-059', 'Data Projects', 'Top Products', 'top_products(sales, n)', 'Aggregate revenue as price × quantity by product. Return up to n product names ordered by revenue descending, then alphabetically for ties.', [
      { args: [[{ product: 'A', price: 2, quantity: 3 }, { product: 'B', price: 5, quantity: 1 }], 1], expected: ['A'] }, { args: [[{ product: 'B', price: 2, quantity: 2 }, { product: 'A', price: 4, quantity: 1 }], 2], expected: ['A', 'B'] }, { args: [[], 3], expected: [] }, { args: [[{ product: 'x', price: 1, quantity: 2 }, { product: 'x', price: 3, quantity: 2 }, { product: 'y', price: 7, quantity: 1 }], 2], expected: ['x', 'y'] }
    ], "def top_products(sales, n):\n    revenue = {}\n    for row in sales:\n        key = row['product']\n        revenue[key] = revenue.get(key, 0) + row['price'] * row['quantity']\n    ordered = sorted(revenue, key=lambda key: (-revenue[key], key))\n    return ordered[:n]", 'Aggregate first; sort names with a negative revenue key.'),
    make('py-060', 'Data Projects', 'Simple CSV Totals', 'simple_csv_totals(text)', 'text contains a header item,amount followed by comma-separated rows. Ignore blank lines and return amount totals by item rounded to 2 decimals. Do not import csv.', [
      { args: ['item,amount\napple,2.5\npear,1\napple,3.25'], expected: { apple: 5.75, pear: 1 } }, { args: ['item,amount\n'], expected: {} }, { args: ['item,amount\nx,1\n\ny,2\nx,4'], expected: { x: 5, y: 2 } }, { args: ['item,amount\na,0.1\na,0.2'], expected: { a: 0.3 } }
    ], "def simple_csv_totals(text):\n    totals = {}\n    lines = text.splitlines()[1:]\n    for line in lines:\n        if not line.strip(): continue\n        item, amount = line.split(',')\n        totals[item] = totals.get(item, 0) + float(amount)\n    return {item: round(amount, 2) for item, amount in totals.items()}", 'Skip the header, split each remaining nonblank line once, and accumulate.'),
  ];

  return {
    problems,
    topics: [...new Set(problems.map((problem) => problem.topic))],
    getProblem(id) {
      return problems.find((problem) => problem.id === id) || null;
    }
  };
}));
