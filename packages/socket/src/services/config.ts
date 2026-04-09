import { BlindCodingQuizzWithId, QuizzWithId, ReverseQuizzWithId } from "@rahoot/common/types/game"
import fs from "fs"
import { resolve } from "path"

const inContainerPath = process.env.CONFIG_PATH

const getPath = (path: string = "") =>
  inContainerPath
    ? resolve(inContainerPath, path)
    : resolve(process.cwd(), "../../config", path)

class Config {
  static init() {
    const isConfigFolderExists = fs.existsSync(getPath())

    if (!isConfigFolderExists) {
      fs.mkdirSync(getPath())
    }

    const isGameConfigExists = fs.existsSync(getPath("game.json"))

    if (!isGameConfigExists) {
      fs.writeFileSync(
        getPath("game.json"),
        JSON.stringify(
          {
            managerPassword: "PASSWORD",
          },
          null,
          2,
        ),
      )
    }

    const isQuizzExists = fs.existsSync(getPath("quizz"))

    if (!isQuizzExists) {
      fs.mkdirSync(getPath("quizz"))

      fs.writeFileSync(
        getPath("quizz/example.json"),
        JSON.stringify(
          {
            subject: "Example Quizz",
            questions: [
              {
                question: "What is good answer ?",
                answers: ["No", "Good answer", "No", "No"],
                solution: 1,
                cooldown: 5,
                time: 15,
              },
              {
                question: "What is good answer with image ?",
                answers: ["No", "No", "No", "Good answer"],
                image: "https://placehold.co/600x400.png",
                solution: 3,
                cooldown: 5,
                time: 20,
              },
              {
                question: "What is good answer with two answers ?",
                answers: ["Good answer", "No"],
                image: "https://placehold.co/600x400.png",
                solution: 0,
                cooldown: 5,
                time: 20,
              },
            ],
          },
          null,
          2,
        ),
      )
    }

    const isReverseProgrammingExists = fs.existsSync(getPath("reverse_programming"))

    if (!isReverseProgrammingExists) {
      fs.mkdirSync(getPath("reverse_programming"))

      fs.writeFileSync(
        getPath("reverse_programming/example.json"),
        JSON.stringify(
          {
            subject: "Python Basics - Reverse Programming",
            questions: [
              {
                output: "Hello, World!",
                language: "python",
                expectedCode: "print('Hello, World!')",
                hint: "Use the print function",
                cooldown: 5,
                time: 90,
              },
              {
                output: "10",
                language: "python",
                expectedCode: "print(2 * 5)",
                hint: "Print the result of a multiplication",
                cooldown: 5,
                time: 90,
              },
            ],
          },
          null,
          2,
        ),
      )
    }

    const isBlindCodingExists = fs.existsSync(getPath("blind_coding"))

    if (!isBlindCodingExists) {
      fs.mkdirSync(getPath("blind_coding"))

      fs.writeFileSync(
        getPath("blind_coding/example.json"),
        JSON.stringify(
          {
            subject: "Blind Coding Challenge",
            questions: [
              {
                title: "Sum Even Or Odd",
                description: "Write a program to check whether the sum of two numbers is even or odd.",
                examples: [
                  { input: "65\n23", output: "Even", explanation: "Sum of 65+23=88 => Even" },
                ],
                constraints: ["-2^30 <= n <= 2^30"],
                language: "python",
                cooldown: 5,
                time: 300,
              },
            ],
          },
          null,
          2,
        ),
      )
    }

    const isBugHuntingExists = fs.existsSync(getPath("bug_hunting"))

    if (!isBugHuntingExists) {
      fs.mkdirSync(getPath("bug_hunting"))

      fs.writeFileSync(
        getPath("bug_hunting/example.json"),
        JSON.stringify(
          {
            subject: "1st Year - Bug Hunting",
            questions: [
              {
                title: "Fix the Hello World",
                description: "This C program should print 'Hello World!' but it has bugs. Fix the code.",
                buggyCode: "#include <stdio.h>\n\nint main() {\n    print(\"Hello World!\");\n    return 0;\n}",
                language: "c",
                expectedOutput: "Hello World!",
                cooldown: 5,
                time: 90,
              },
            ],
          },
          null,
          2,
        ),
      )
    }
  }

  static game() {
    const isExists = fs.existsSync(getPath("game.json"))

    if (!isExists) {
      throw new Error("Game config not found")
    }

    try {
      const config = fs.readFileSync(getPath("game.json"), "utf-8")

      return JSON.parse(config)
    } catch (error) {
      console.error("Failed to read game config:", error)
    }

    return {}
  }

  static quizz() {
    const isExists = fs.existsSync(getPath("quizz"))

    if (!isExists) {
      return []
    }

    try {
      const files = fs
        .readdirSync(getPath("quizz"))
        .filter((file) => file.endsWith(".json"))

      const quizz: QuizzWithId[] = files.map((file) => {
        const data = fs.readFileSync(getPath(`quizz/${file}`), "utf-8")
        const config = JSON.parse(data)

        const id = file.replace(".json", "")

        return {
          id,
          ...config,
        }
      })

      return quizz || []
    } catch (error) {
      console.error("Failed to read quizz config:", error)

      return []
    }
  }

  static reverseQuizz() {
    const isExists = fs.existsSync(getPath("reverse_programming"))

    if (!isExists) {
      return []
    }

    try {
      const files = fs
        .readdirSync(getPath("reverse_programming"))
        .filter((file) => file.endsWith(".json"))

      const quizz: ReverseQuizzWithId[] = files.map((file) => {
        const data = fs.readFileSync(getPath(`reverse_programming/${file}`), "utf-8")
        const config = JSON.parse(data)

        const id = file.replace(".json", "")

        return {
          id,
          ...config,
        }
      })

      return quizz || []
    } catch (error) {
      console.error("Failed to read reverse programming config:", error)

      return []
    }
  }

  static blindCoding() {
    const isExists = fs.existsSync(getPath("blind_coding"))

    if (!isExists) {
      return []
    }

    try {
      const files = fs
        .readdirSync(getPath("blind_coding"))
        .filter((file) => file.endsWith(".json"))

      const quizz: BlindCodingQuizzWithId[] = files.map((file) => {
        const data = fs.readFileSync(getPath(`blind_coding/${file}`), "utf-8")
        const config = JSON.parse(data)

        const id = file.replace(".json", "")

        return {
          id,
          ...config,
        }
      })

      return quizz || []
    } catch (error) {
      console.error("Failed to read blind coding config:", error)

      return []
    }
  }

  static bugHunting() {
    const isExists = fs.existsSync(getPath("bug_hunting"))

    if (!isExists) {
      return []
    }

    try {
      const files = fs
        .readdirSync(getPath("bug_hunting"))
        .filter((file) => file.endsWith(".json"))

      const quizz: any[] = files.map((file) => {
        const data = fs.readFileSync(getPath(`bug_hunting/${file}`), "utf-8")
        const config = JSON.parse(data)

        const id = file.replace(".json", "")

        return {
          id,
          ...config,
        }
      })

      return quizz || []
    } catch (error) {
      console.error("Failed to read bug hunting config:", error)

      return []
    }
  }
}

export default Config
