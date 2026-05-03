class Shadow < Formula
  desc "Understand, trace, test, and improve any codebase from the terminal"
  homepage "https://github.com/OpceanAI/Shadow"
  url "https://registry.npmjs.org/shadow/-/shadow-0.1.0.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    system "#{bin}/shadow", "--version"
  end
end
